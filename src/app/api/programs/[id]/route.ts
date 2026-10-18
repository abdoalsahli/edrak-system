import { NextResponse } from "next/server";
import { requireAuth, ok, notFound, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { transferTherapist } from "@/lib/scheduling/SchedulingService";
import { recalcProgramInvoice } from "@/lib/billing/InvoiceService";
import { syncProgramCommissionLedger } from "@/lib/ledger/LedgerService";
import { z } from "zod";
import { addDays } from "date-fns";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const program = await prisma.program.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, fullName: true } },
      therapist: { select: { id: true, fullName: true } },
      service: { select: { name: true, defaultDurationMin: true } },
      sessions: {
        include: {
          appointments: {
            where: { deletedAt: null },
            include: { therapist: { select: { fullName: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { programSequenceNumber: "asc" },
      },
      billingCycles: {
        include: {
          invoices: {
            select: {
              id: true, status: true,
              totalAmount: true, paidAmount: true, issueDate: true,
            },
            orderBy: { issueDate: "asc" },
          },
        },
        orderBy: { cycleNumber: "asc" },
      },
    },
  });
  if (!program) return notFound();

  const consumedCount = program.sessions.filter((s) =>
    s.status === "COMPLETED" || s.status === "ABSENT"
  ).length;

  return ok({ ...program, consumedSessions: consumedCount, remainingSessions: program.plannedSessions - consumedCount });
}

const ExtendSchema = z.object({
  action: z.literal("extend"),
  additionalSessions: z.number().int().min(1),
  appointments: z.array(z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    sequenceNumber: z.number(),
  })),
});

const RescheduleSchema = z.object({
  action: z.literal("reschedule"),
  sessionsPerWeek: z.number().int().min(1).max(7),
  // One slot per remaining session, in programme order
  appointments: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })).min(1),
});

const RepriceSchema = z.object({
  action: z.literal("reprice"),
  sessionPrice: z.number().min(0, "قيمة الجلسة لا تكون سالبة"),
  sessionCommission: z.number().min(0, "العمولة لا تكون سالبة"),
  // Delivered sessions keep their agreed value unless the change is meant for them too
  includeCompleted: z.boolean().default(false),
});

const CompleteSchema = z.object({ action: z.literal("complete") });
const CancelSchema = z.object({ action: z.literal("cancel"), reason: z.string().optional() });

const TransferSchema = z.object({
  action: z.literal("transfer"),
  newTherapistId: z.string(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.id;

  const body = await req.json();

  if (body.action === "transfer") {
    const parsed = TransferSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
    const d = parsed.data;
    // Only managers can transfer therapists
    if (auth.role !== "MANAGER") return new NextResponse("Forbidden", { status: 403 });
    await transferTherapist(params.id, d.newTherapistId, d.effectiveDate, d.reason ?? null, userId);
    return ok({ ok: true });
  }

  if (body.action === "extend") {
    const parsed = ExtendSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
    const d = parsed.data;

    const prog = await prisma.program.findUnique({ where: { id: params.id } });
    if (!prog) return notFound();

    const sortedApts = [...d.appointments].sort((a, b) => a.date.localeCompare(b.date));
    const lastDate = sortedApts[sortedApts.length - 1]?.date;

    await prisma.$transaction(async (tx) => {
      for (const apt of d.appointments) {
        const session = await tx.session.create({
          data: {
            patientId: prog.patientId,
            serviceId: prog.serviceId,
            programId: prog.id,
            programSequenceNumber: apt.sequenceNumber,
            status: "PENDING",
            // Extended sessions inherit the program's agreed price and commission
            price: prog.sessionPrice,
            commissionAmount: prog.sessionCommission,
            createdBy: userId,
          },
        });
        if (prog.sessionCommission && Number(prog.sessionCommission) > 0) {
          await tx.therapistCommission.create({
            data: {
              therapistId:    prog.therapistId,
              sessionId:      session.id,
              commissionType: "FIXED",
              rate:           null,
              baseAmount:     null,
              amount:         prog.sessionCommission,
              isEarned:       false,
            },
          });
        }
        await tx.appointment.create({
          data: {
            sessionId: session.id,
            therapistId: prog.therapistId,
            date: new Date(apt.date),
            startTime: apt.startTime,
            endTime: apt.endTime,
            status: "SCHEDULED",
            scheduledBy: userId,
          },
        });
      }
      await tx.program.update({
        where: { id: params.id },
        data: {
          plannedSessions: { increment: d.additionalSessions },
          status: "EXTENDED",
          ...(lastDate ? { expectedEndDate: addDays(new Date(lastDate), 1) } : {}),
        },
      });

      // Bill the added sessions and add their commission in one adjustment
      await recalcProgramInvoice(tx, params.id);
      await syncProgramCommissionLedger(tx, params.id);
    });
    return ok({ ok: true });
  }

  if (body.action === "reschedule") {
    const parsed = RescheduleSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
    const d = parsed.data;

    const prog = await prisma.program.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!prog) return notFound();
    if (prog.status !== "ACTIVE" && prog.status !== "EXTENDED") {
      return badRequest({ message: "لا يمكن تعديل مواعيد برنامج منتهٍ أو ملغى" });
    }

    const pending = await prisma.session.findMany({
      where: { programId: params.id, status: "PENDING" },
      orderBy: { programSequenceNumber: "asc" },
      include: { appointments: { where: { status: "SCHEDULED", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (pending.length !== d.appointments.length) {
      return badRequest({ message: `عدد المواعيد (${d.appointments.length}) لا يطابق الجلسات المتبقية (${pending.length}) — أعد المعاينة` });
    }

    const slots = [...d.appointments].sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
    await prisma.$transaction(async (tx) => {
      for (const [i, s] of pending.entries()) {
        const slot = slots[i];
        const old = s.appointments[0];
        // Unchanged slot: leave it alone
        if (old && old.date.toISOString().slice(0, 10) === slot.date && old.startTime === slot.startTime && old.endTime === slot.endTime) continue;
        if (old) await tx.appointment.update({ where: { id: old.id }, data: { status: "CANCELLED" } });
        await tx.appointment.create({
          data: {
            sessionId: s.id,
            therapistId: old?.therapistId ?? (await tx.program.findUniqueOrThrow({ where: { id: params.id } })).therapistId,
            roomId: old?.roomId ?? null,
            date: new Date(slot.date),
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: "SCHEDULED",
            originalAppointmentId: old?.id ?? null,
            isInsuranceCovered: old?.isInsuranceCovered ?? false,
            insuranceProviderId: old?.insuranceProviderId ?? null,
            scheduledBy: userId,
          },
        });
        await tx.sessionAuditLog.create({
          data: {
            sessionId: s.id,
            action: "RESCHEDULED",
            previousValue: old ? { date: old.date, startTime: old.startTime } : undefined,
            newValue: { date: slot.date, startTime: slot.startTime, reason: "تعديل مواعيد البرنامج" },
            performedBy: userId,
          },
        });
      }
      await tx.program.update({
        where: { id: params.id },
        data: {
          sessionsPerWeek: d.sessionsPerWeek,
          expectedEndDate: addDays(new Date(slots[slots.length - 1].date), 1),
        },
      });
    });
    return ok({ ok: true, moved: pending.length });
  }

  if (body.action === "reprice") {
    if (auth.role !== "MANAGER") return badRequest({ message: "تعديل قيمة البرنامج متاح للمدير فقط" });
    const parsed = RepriceSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
    const d = parsed.data;

    const prog = await prisma.program.findUnique({ where: { id: params.id }, select: { status: true } });
    if (!prog) return notFound();
    if (prog.status !== "ACTIVE" && prog.status !== "EXTENDED") {
      return badRequest({ message: "لا يمكن تعديل قيمة برنامج منتهٍ أو ملغى" });
    }

    const result = await prisma.$transaction(async (tx) => {
      const sessions = await tx.session.findMany({
        where: { programId: params.id, status: { in: d.includeCompleted ? ["PENDING", "COMPLETED"] : ["PENDING"] } },
        select: { id: true },
      });
      const ids = sessions.map((s) => s.id);
      await tx.session.updateMany({ where: { id: { in: ids } }, data: { price: d.sessionPrice, commissionAmount: d.sessionCommission } });
      // Commissions already paid out stay as paid; the rest follow the new rate
      await tx.therapistCommission.updateMany({
        where: { sessionId: { in: ids }, isPaid: false },
        data: { amount: d.sessionCommission },
      });
      await tx.program.update({
        where: { id: params.id },
        data: { sessionPrice: d.sessionPrice, sessionCommission: d.sessionCommission },
      });
      // One adjustment on the patient account (invoice) and one on the therapist account
      const invoice = await recalcProgramInvoice(tx, params.id);
      await syncProgramCommissionLedger(tx, params.id);
      return { updated: ids.length, invoice };
    });
    return ok({ ok: true, ...result });
  }

  if (body.action === "complete") {
    CompleteSchema.parse(body);
    const result = await prisma.$transaction(async (tx) => {
      await tx.program.update({ where: { id: params.id }, data: { status: "COMPLETED" } });

      // Sessions still pending will never take place: cancel them and free the calendar
      const pending = await tx.session.findMany({
        where: { programId: params.id, status: "PENDING" },
        select: { id: true },
      });
      if (pending.length) {
        const ids = pending.map((x) => x.id);
        await tx.session.updateMany({ where: { id: { in: ids } }, data: { status: "CANCELLED_BY_CENTER" } });
        await tx.appointment.updateMany({
          where: { sessionId: { in: ids }, status: "SCHEDULED", deletedAt: null },
          data: { status: "CANCELLED" },
        });
      }

      // Sessions never delivered: drop their commission (one adjustment on the therapist account)
      const undelivered = await tx.session.findMany({
        where: { programId: params.id, status: { not: "COMPLETED" } },
        select: { id: true },
      });
      await tx.therapistCommission.deleteMany({
        where: { sessionId: { in: undelivered.map((x) => x.id) }, isPaid: false },
      });
      await syncProgramCommissionLedger(tx, params.id);

      // Final settlement: bill only the sessions actually delivered
      return recalcProgramInvoice(tx, params.id);
    });
    return ok({ ok: true, invoice: result });
  }

  if (body.action === "cancel") {
    const parsed = CancelSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

    const result = await prisma.$transaction(async (tx) => {
      // Cancel the program itself
      await tx.program.update({
        where: { id: params.id },
        data: { status: "CANCELLED", cancellationReason: parsed.data.reason ?? null },
      });

      // Cancel all pending sessions
      const pendingSessions = await tx.session.findMany({
        where: { programId: params.id, status: "PENDING" },
        select: { id: true },
      });
      const pendingIds = pendingSessions.map((s) => s.id);

      if (pendingIds.length > 0) {
        await tx.session.updateMany({
          where: { id: { in: pendingIds } },
          data: { status: "CANCELLED_BY_CENTER" },
        });

        // Cancel their scheduled appointments
        await tx.appointment.updateMany({
          where: { sessionId: { in: pendingIds }, status: "SCHEDULED", deletedAt: null },
          data: { status: "CANCELLED" },
        });

        // Those sessions will never be delivered — reverse their accrued commission
        await tx.therapistCommission.deleteMany({
          where: { sessionId: { in: pendingIds }, isPaid: false },
        });
        await syncProgramCommissionLedger(tx, params.id);
      }

      // Settle the invoice at the value actually delivered.
      // (Not voided — sessions already completed remain payable.)
      return recalcProgramInvoice(tx, params.id);
    });

    return ok({ ok: true, invoice: result });
  }

  return badRequest({ message: "action غير معروف" });
}
