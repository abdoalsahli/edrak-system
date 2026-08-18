import { NextResponse } from "next/server";
import { requireAuth, ok, notFound, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { transferTherapist } from "@/lib/scheduling/SchedulingService";
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
            createdBy: userId,
          },
        });
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
    });
    return ok({ ok: true });
  }

  if (body.action === "complete") {
    CompleteSchema.parse(body);
    await prisma.program.update({ where: { id: params.id }, data: { status: "COMPLETED" } });
    return ok({ ok: true });
  }

  if (body.action === "cancel") {
    const parsed = CancelSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
    await prisma.program.update({
      where: { id: params.id },
      data: { status: "CANCELLED", cancellationReason: parsed.data.reason ?? null },
    });
    return ok({ ok: true });
  }

  return badRequest({ message: "action غير معروف" });
}
