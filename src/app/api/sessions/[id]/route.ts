import { NextResponse } from "next/server";
import { requireAuth, ok, notFound, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { rescheduleSession } from "@/lib/scheduling/SchedulingService";
import { z } from "zod";

const OutcomeSchema = z.object({
  status: z.enum(["COMPLETED", "ABSENT", "CANCELLED_BY_PATIENT", "CANCELLED_BY_CENTER"]),
  outcomeNotes: z.string().optional(),
});

const RescheduleSchema = z.object({
  action: z.literal("reschedule"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().int().min(15),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { id: true, fullName: true } },
      service: { select: { name: true, deliveryType: true } },
      program: { select: { id: true } },
      appointments: {
        where: { deletedAt: null },
        include: {
          therapist: { select: { fullName: true } },
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
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();

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

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
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

    // Auto-create therapist commission when session is COMPLETED
    if (d.status === "COMPLETED") {
      const apt = session.appointments[0];
      const therapist = apt?.therapist;
      if (therapist?.commissionType) {
        const baseAmount = session.invoiceLines.reduce((sum, l) => sum + Number(l.total), 0);

        let commissionData: Parameters<typeof tx.therapistCommission.upsert>[0]["create"] | null = null;

        if (therapist.commissionType === "FIXED" && therapist.commissionFixed) {
          commissionData = {
            therapistId:    apt.therapistId,
            sessionId:      params.id,
            commissionType: "FIXED",
            rate:           null,
            baseAmount:     null,
            amount:         Number(therapist.commissionFixed),
          };
        } else if (therapist.commissionType === "PERCENTAGE" && therapist.commissionRate && baseAmount > 0) {
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
            update: { commissionType: commissionData.commissionType, rate: commissionData.rate, baseAmount: commissionData.baseAmount, amount: commissionData.amount },
            create: commissionData,
          });
        }
      }
    }

    await tx.sessionAuditLog.create({
      data: {
        sessionId: params.id,
        action: "OUTCOME_RECORDED",
        previousValue: { status: "PENDING" },
        newValue: { status: d.status, notes: d.outcomeNotes },
        performedBy: auth.id,
      },
    });
    return s;
  });

  return ok(updated);
}
