import { NextResponse } from "next/server";
import { requireAuth, ok, notFound, badRequest, forbidden, therapistIdOf } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rescheduleSession, validateAvailability } from "@/lib/scheduling/SchedulingService";
import { recalcInvoiceForSession, recalcProgramInvoice } from "@/lib/billing/InvoiceService";
import { syncCommissionLedger, syncProgramCommissionLedger, deleteSourceEntries } from "@/lib/ledger/LedgerService";
import { z } from "zod";

const OutcomeSchema = z
  .object({
    status: z.enum(["COMPLETED", "ABSENT", "CANCELLED_BY_PATIENT", "CANCELLED_BY_CENTER"]),
    outcomeNotes: z.string().optional(),
    // For an absence or cancellation the user must decide whether it is charged
    charge: z.boolean().optional(),
  })
  .refine((d) => d.status === "COMPLETED" || typeof d.charge === "boolean", {
    message: "حدّد هل تُحتسب قيمة الجلسة",
    path: ["charge"],
  });

const CHARGED_LINE_LABEL: Record<string, string> = {
  COMPLETED: "جلسة مكتملة",
  ABSENT: "غياب — محتسبة",
  CANCELLED_BY_PATIENT: "إلغاء من الحالة — محتسبة",
  CANCELLED_BY_CENTER: "إلغاء من المركز — محتسبة",
};

/** تعديل الجلسة — any of these may change while the session has not been held yet. */
const UpdateSchema = z.object({
  action: z.literal("update"),
  serviceId: z.string().optional(),
  therapistId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMin: z.number().int().min(15, "المدة 15 دقيقة على الأقل").max(480).optional(),
  price: z.number().min(0, "القيمة لا تكون سالبة").optional(),
});

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const RescheduleSchema = z.object({
  action: z.literal("reschedule"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().min(15),
});

// Change the charge decision of an absent / cancelled session after the fact
const SetChargeSchema = z.object({
  action: z.literal("setCharge"),
  charge: z.boolean(),
});

const CHARGEABLE_STATUSES = ["ABSENT", "CANCELLED_BY_PATIENT", "CANCELLED_BY_CENTER"];

/** «غياب الجلسة #3 من برنامج» — the start of the ledger line for a programme session event. */
const OUTCOME_EVENT: Record<string, string> = {
  COMPLETED: "إكمال",
  ABSENT: "غياب",
  CANCELLED_BY_PATIENT: "إلغاء من الحالة",
  CANCELLED_BY_CENTER: "إلغاء المركز",
};
const sessionEvent = (event: string, seq: number | null) => `${event} الجلسة${seq != null ? ` #${seq}` : ""} من برنامج`;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, fullName: true } },
      service: { select: { name: true, deliveryType: true } },
      // The program's invoice covers program sessions
      program: {
        select: {
          id: true,
          invoice: { select: { id: true, status: true, totalAmount: true, paidAmount: true } },
        },
      },
      // The auto-invoice for a standalone session (exists from the moment it is booked)
      standaloneInvoice: {
        select: { id: true, status: true, totalAmount: true, paidAmount: true },
      },
      appointments: {
        where: { deletedAt: null },
        include: {
          therapist: { select: { id: true, fullName: true } },
          room: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      invoiceLines: {
        include: {
          invoice: {
            select: { id: true, status: true, totalAmount: true, paidAmount: true },
          },
        },
      },
      commission: {
        include: {
          therapist: { select: { fullName: true } },
        },
      },
    },
  });

  if (!session) return notFound();
  return ok(session);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER", "THERAPIST"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();

  // A therapist may only record the outcome of a session booked with them
  if (auth.role === "THERAPIST") {
    if (body.action) return forbidden();
    const therapistId = await therapistIdOf(auth.id);
    const own = therapistId
      ? await prisma.appointment.findFirst({
          where: { sessionId: params.id, therapistId, status: "SCHEDULED", deletedAt: null },
          select: { id: true },
        })
      : null;
    if (!own) return forbidden();
  }

  if (body.action === "setCharge") {
    // Changing a financial decision after it was recorded is a manager call
    if (auth.role !== "MANAGER") {
      return NextResponse.json({ message: "تغيير الاحتساب يتطلب صلاحية المدير" }, { status: 403 });
    }
    const parsedCharge = SetChargeSchema.safeParse(body);
    if (!parsedCharge.success) return badRequest(parsedCharge.error.flatten().fieldErrors);
    const charge = parsedCharge.data.charge;

    const target = await prisma.session.findUnique({
      where: { id: params.id },
      include: { service: { select: { name: true } } },
    });
    if (!target) return notFound();
    if (!CHARGEABLE_STATUSES.includes(target.status)) {
      return badRequest({ message: "الاحتساب يُحدَّد فقط للجلسات المسجّلة غياباً أو إلغاءً" });
    }
    if (target.isCharged === charge) return ok({ ok: true });

    await prisma.$transaction(async (tx) => {
      await tx.session.update({ where: { id: params.id }, data: { isCharged: charge } });

      const invoice = target.programId
        ? await tx.invoice.findUnique({ where: { programId: target.programId } })
        : await tx.invoice.findUnique({ where: { sessionId: params.id } });

      if (invoice) {
        if (charge) {
          const price = Number(target.price ?? 0);
          if (price > 0) {
            await tx.invoiceLine.create({
              data: {
                invoiceId:   invoice.id,
                sessionId:   params.id,
                description: `${target.service?.name ?? "جلسة"} — ${CHARGED_LINE_LABEL[target.status]}`,
                qty:         1,
                unitPrice:   price,
                discount:    0,
                total:       price,
              },
            });
          }
        } else {
          await tx.invoiceLine.deleteMany({ where: { invoiceId: invoice.id, sessionId: params.id } });
        }
      }

      await recalcInvoiceForSession(
        tx, params.id, target.programId,
        sessionEvent(charge ? "احتساب" : "إلغاء احتساب", target.programSequenceNumber)
      );

      await tx.sessionAuditLog.create({
        data: {
          sessionId: params.id,
          action: "CHARGE_CHANGED",
          previousValue: { isCharged: target.isCharged },
          newValue: { isCharged: charge },
          performedBy: auth.id,
        },
      });
    });

    return ok({ ok: true });
  }

  if (body.action === "update") {
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
    const d = parsed.data;

    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        service: { select: { name: true } },
        commission: { select: { id: true, isPaid: true, therapistId: true } },
        appointments: { where: { status: "SCHEDULED", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!session) return notFound();
    if (session.status !== "PENDING") return badRequest({ message: "لا يمكن تعديل جلسة سُجّلت نتيجتها" });
    if (d.serviceId && d.serviceId !== session.serviceId && session.programId) {
      return badRequest({ message: "خدمة جلسة البرنامج هي خدمة البرنامج نفسه — لا تُغيَّر من الجلسة" });
    }
    const newService = d.serviceId && d.serviceId !== session.serviceId
      ? await prisma.service.findUnique({ where: { id: d.serviceId }, select: { id: true, name: true, isActive: true } })
      : null;
    if (d.serviceId && d.serviceId !== session.serviceId && (!newService || !newService.isActive)) {
      return badRequest({ message: "الخدمة غير موجودة أو معطّلة" });
    }

    // The slot: whatever was not sent stays as booked
    const apt = session.appointments[0];
    const curDate = apt ? apt.date.toISOString().slice(0, 10) : null;
    const therapistId = d.therapistId ?? apt?.therapistId;
    const date = d.date ?? curDate;
    const startTime = d.startTime ?? apt?.startTime;
    const duration = d.durationMin ?? (apt ? toMins(apt.endTime) - toMins(apt.startTime) : 60);
    if (!therapistId || !date || !startTime) return badRequest({ message: "حدّد الأخصائي والتاريخ والوقت" });
    const endTime = toTime(toMins(startTime) + duration);
    const slotChanged = !apt || therapistId !== apt.therapistId || date !== curDate || startTime !== apt.startTime || endTime !== apt.endTime;
    const therapistChanged = !!apt && therapistId !== apt.therapistId;
    const priceChanged = d.price !== undefined && Math.abs(d.price - Number(session.price ?? 0)) > 0.005;

    if (slotChanged) {
      const check = await validateAvailability(therapistId, session.patientId, date, startTime, endTime, apt?.id);
      if (!check.ok) return badRequest({ message: check.reason });
    }
    if (!slotChanged && !priceChanged && !newService) return ok({ ok: true, changed: false });

    const event = session.programId ? sessionEvent("تعديل", session.programSequenceNumber) : undefined;
    await prisma.$transaction(async (tx) => {
      if (slotChanged) {
        if (apt) await tx.appointment.update({ where: { id: apt.id }, data: { status: "CANCELLED" } });
        await tx.appointment.create({
          data: {
            sessionId: session.id,
            therapistId,
            roomId: apt?.roomId ?? null,
            date: new Date(date),
            startTime,
            endTime,
            status: "SCHEDULED",
            originalAppointmentId: apt?.id ?? null,
            isInsuranceCovered: apt?.isInsuranceCovered ?? false,
            insuranceProviderId: apt?.insuranceProviderId ?? null,
            scheduledBy: auth.id,
          },
        });
      }

      await tx.session.update({
        where: { id: session.id },
        data: {
          ...(newService ? { serviceId: newService.id } : {}),
          ...(priceChanged ? { price: d.price } : {}),
        },
      });

      // A standalone session's invoice is named after its service
      if (newService && !session.programId) {
        await tx.invoice.updateMany({ where: { sessionId: session.id }, data: { notes: `فاتورة جلسة — ${newService.name}` } });
      }

      // The accrued commission follows the session to its new therapist
      if (therapistChanged && session.commission && !session.commission.isPaid) {
        await tx.therapistCommission.update({ where: { id: session.commission.id }, data: { therapistId } });
      }

      if (priceChanged) await recalcInvoiceForSession(tx, session.id, session.programId, event);
      if (therapistChanged && session.programId) await syncProgramCommissionLedger(tx, session.programId, event);

      await tx.sessionAuditLog.create({
        data: {
          sessionId: session.id,
          action: "UPDATED",
          previousValue: {
            service: session.service.name, price: Number(session.price ?? 0),
            therapistId: apt?.therapistId ?? null, date: curDate, startTime: apt?.startTime ?? null, endTime: apt?.endTime ?? null,
          },
          newValue: {
            service: newService?.name ?? session.service.name, price: priceChanged ? d.price : Number(session.price ?? 0),
            therapistId, date, startTime, endTime,
          },
          performedBy: auth.id,
        },
      });
    });
    return ok({ ok: true, changed: true });
  }

  if (body.action === "reschedule") {
    const parsed = RescheduleSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    const result = await rescheduleSession(
      params.id,
      d.date,
      d.startTime,
      d.durationMin,
      auth.id
    );
    if (!result.ok) return badRequest({ message: result.error });
    return ok({ appointmentId: result.appointmentId });
  }

  // Record outcome
  const parsed = OutcomeSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  // Only an absence / cancellation carries a charge decision; completed is always billed
  const charge = d.status !== "COMPLETED" && d.charge === true;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      service: { select: { name: true } },
      appointments: {
        where: { deletedAt: null, status: "SCHEDULED" },
        include: { therapist: { select: { id: true, fullName: true, commissionType: true, commissionRate: true, commissionFixed: true } } },
      },
      invoiceLines: { include: { invoice: true } },
    },
  });
  if (!session) return notFound();
  if (session.status !== "PENDING") return badRequest({ message: "الجلسة مكتملة بالفعل" });

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.session.update({
      where: { id: params.id },
      data: {
        status: d.status,
        isCharged: charge,
        outcomeNotes: d.outcomeNotes ?? null,
        deliveredAt: d.status === "COMPLETED" ? new Date() : null,
      },
    });

    // Mark appointment as delivered or cancelled
    if (d.status === "COMPLETED" || d.status === "ABSENT") {
      await tx.appointment.updateMany({
        where: { sessionId: params.id, status: "SCHEDULED", deletedAt: null },
        data: { status: "DELIVERED" },
      });
    } else {
      await tx.appointment.updateMany({
        where: { sessionId: params.id, status: "SCHEDULED", deletedAt: null },
        data: { status: "CANCELLED" },
      });
    }

    // Track the delivered session as an invoice line (breakdown / audit trail)
    let lineTotal = Number(session.price ?? 0);
    if (d.status === "COMPLETED" || charge) {
      // Find the auto-invoice: program invoice or standalone invoice
      const invoice = session.programId
        ? await tx.invoice.findUnique({ where: { programId: session.programId } })
        : await tx.invoice.findUnique({ where: { sessionId: params.id } });

      if (invoice && lineTotal > 0) {
        const line = await tx.invoiceLine.create({
          data: {
            invoiceId:   invoice.id,
            sessionId:   params.id,
            description: `${session.service?.name ?? "جلسة"} — ${CHARGED_LINE_LABEL[d.status]}`,
            qty:         1,
            unitPrice:   lineTotal,
            discount:    0,
            total:       lineTotal,
          },
        });
        // Commission is owed on what was actually billed, after any discount.
        lineTotal = Number(line.total);
      }
    }

    // Keep the invoice total in sync with the program/session state.
    const event = sessionEvent(OUTCOME_EVENT[d.status], session.programSequenceNumber);
    await recalcInvoiceForSession(tx, params.id, session.programId, event);

    if (d.status !== "COMPLETED") {
      // Absent or cancelled: the session was never delivered, so reverse the accrued commission
      await tx.therapistCommission.deleteMany({ where: { sessionId: params.id, isPaid: false } });
      await syncCommissionLedger(tx, params.id, event);
    }

    // Auto-create therapist commission when session is COMPLETED
    if (d.status === "COMPLETED") {
      const apt = session.appointments[0];
      const therapist = apt?.therapist;
      const agreedCommission = session.commissionAmount != null ? Number(session.commissionAmount) : null;
      if (apt && (agreedCommission !== null || therapist?.commissionType)) {
        const baseAmount = lineTotal;

        let commissionData: Parameters<typeof tx.therapistCommission.upsert>[0]["create"] | null = null;

        if (agreedCommission !== null) {
          // The programme agreed this session's commission — it overrides the therapist default
          commissionData = {
            therapistId:    apt.therapistId,
            sessionId:      params.id,
            commissionType: "FIXED",
            rate:           null,
            baseAmount:     null,
            amount:         agreedCommission,
          };
        } else if (therapist?.commissionType === "FIXED" && therapist.commissionFixed) {
          commissionData = {
            therapistId:    apt.therapistId,
            sessionId:      params.id,
            commissionType: "FIXED",
            rate:           null,
            baseAmount:     null,
            amount:         Number(therapist.commissionFixed),
          };
        } else if (therapist?.commissionType === "PERCENTAGE" && therapist.commissionRate && baseAmount > 0) {
          const rate = Number(therapist.commissionRate);
          commissionData = {
            therapistId:    apt.therapistId,
            sessionId:      params.id,
            commissionType: "PERCENTAGE",
            rate,
            baseAmount,
            amount:         (baseAmount * rate) / 100,
          };
        }

        if (commissionData) {
          await tx.therapistCommission.upsert({
            where:  { sessionId: params.id },
            update: {
              commissionType: commissionData.commissionType,
              rate:           commissionData.rate,
              baseAmount:     commissionData.baseAmount,
              amount:         commissionData.amount,
              isEarned:       true,
            },
            create: { ...commissionData, isEarned: true },
          });
          await syncCommissionLedger(tx, params.id, event);
        }
      }
    }

    await tx.sessionAuditLog.create({
      data: {
        sessionId: params.id,
        action: "OUTCOME_RECORDED",
        previousValue: { status: "PENDING" },
        newValue: { status: d.status, notes: d.outcomeNotes, charged: d.status === "COMPLETED" ? true : charge },
        performedBy: auth.id,
      },
    });
    return s;
  });

  return ok(updated);
}

/**
 * Delete a session booked by mistake.
 *
 * Only a PENDING session with no money attached can be deleted. Once it has an
 * outcome, a commission or a numbered receipt, the financial trail must be kept —
 * record it as cancelled (uncharged) instead.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      commission: { select: { id: true, isPaid: true } },
      standaloneInvoice: { select: { id: true, _count: { select: { payments: true } } } },
    },
  });
  if (!session) return notFound();

  if (session.status !== "PENDING") {
    return badRequest({ message: "لا يمكن حذف جلسة سُجّلت نتيجتها — الحذف متاح للجلسات المعلّقة فقط" });
  }
  if (session.commission?.isPaid) {
    return badRequest({ message: "لا يمكن حذف جلسة صُرفت عمولتها للمعالج" });
  }
  if (session.standaloneInvoice && session.standaloneInvoice._count.payments > 0) {
    return badRequest({
      message: "لا يمكن حذف جلسة عليها سندات قبض مرقّمة — سجّلها «ألغاها المركز» بدون احتساب ثم استرد المبلغ",
    });
  }

  const programId = session.programId;
  const seq = session.programSequenceNumber;

  await prisma.$transaction(async (tx) => {
    // Rescheduled appointments point at the one they replaced — unlink first
    await tx.appointment.updateMany({
      where: { originalAppointment: { sessionId: params.id } },
      data: { originalAppointmentId: null },
    });
    await tx.appointment.deleteMany({ where: { sessionId: params.id } });
    await tx.sessionAuditLog.deleteMany({ where: { sessionId: params.id } });
    await tx.invoiceLine.deleteMany({ where: { sessionId: params.id } });
    await tx.therapistCommission.deleteMany({ where: { sessionId: params.id, isPaid: false } });
    // A booking made by mistake: remove its postings rather than reversing them
    await deleteSourceEntries(tx, "COMMISSION", params.id);
    // Documents belong to the patient; keep them, just detach from the session
    await tx.document.updateMany({ where: { sessionId: params.id }, data: { sessionId: null } });

    if (session.standaloneInvoice) {
      await deleteSourceEntries(tx, "INVOICE", session.standaloneInvoice.id);
      await tx.invoice.delete({ where: { id: session.standaloneInvoice.id } });
    }

    await tx.session.delete({ where: { id: params.id } });

    if (programId) {
      // Close the gap in the program numbering (ascending, so no unique clash)
      if (seq != null) {
        const later = await tx.session.findMany({
          where: { programId, programSequenceNumber: { gt: seq } },
          orderBy: { programSequenceNumber: "asc" },
          select: { id: true, programSequenceNumber: true },
        });
        for (const s of later) {
          await tx.session.update({
            where: { id: s.id },
            data: { programSequenceNumber: (s.programSequenceNumber ?? 1) - 1 },
          });
        }
      }
      await tx.program.update({
        where: { id: programId },
        data: { plannedSessions: { decrement: 1 } },
      });
      await recalcProgramInvoice(tx, programId, sessionEvent("حذف", seq));
      await syncProgramCommissionLedger(tx, programId, sessionEvent("حذف", seq));
    }
  });

  return ok({ ok: true, programId });
}
