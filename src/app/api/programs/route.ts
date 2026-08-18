import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays, format } from "date-fns";

const CreateSchema = z.object({
  patientId: z.string(),
  serviceId: z.string(),
  therapistId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionsPerWeek: z.number().int().min(1).max(7),
  totalSessions: z.number().int().min(1),
  durationMin: z.number().int().min(15).default(60),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
  // proposed appointments from the scheduling wizard preview
  appointments: z.array(z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    sequenceNumber: z.number(),
  })),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");
  const q = searchParams.get("q") ?? "";
  const { skip, take } = paginate(searchParams);

  const where = {
    ...(patientId ? { patientId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q ? { patient: { fullName: { contains: q } } } : {}),
  };

  const [programs, total] = await Promise.all([
    prisma.program.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true } },
        therapist: { select: { fullName: true } },
        service: { select: { name: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.program.count({ where }),
  ]);

  // Compute consumed sessions per program
  const programIds = programs.map((p) => p.id);
  const consumed = await prisma.session.groupBy({
    by: ["programId"],
    where: { programId: { in: programIds }, status: { in: ["COMPLETED", "ABSENT"] } },
    _count: { _all: true },
  });
  const consumedMap = Object.fromEntries(consumed.map((c) => [c.programId!, c._count._all]));

  const data = programs.map((p) => ({
    ...p,
    consumedSessions: consumedMap[p.id] ?? 0,
    remainingSessions: p.plannedSessions - (consumedMap[p.id] ?? 0),
  }));

  return NextResponse.json({ data, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  const d = parsed.data;
  const userId = auth.id;

  // Compute expected end date from the last appointment
  const sortedApts = [...d.appointments].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = sortedApts[sortedApts.length - 1]?.date ?? d.startDate;
  const expectedEndDate = addDays(new Date(lastDate), 1);

  const program = await prisma.$transaction(async (tx) => {
    const prog = await tx.program.create({
      data: {
        patientId: d.patientId,
        serviceId: d.serviceId,
        therapistId: d.therapistId,
        startDate: new Date(d.startDate),
        expectedEndDate,
        sessionsPerWeek: d.sessionsPerWeek,
        originalPlannedSessions: d.totalSessions,
        plannedSessions: d.totalSessions,
        status: "ACTIVE",
        notes: d.notes ?? null,
        createdBy: userId,
      },
    });

    // Create sessions + appointments in bulk
    for (const apt of d.appointments) {
      const session = await tx.session.create({
        data: {
          patientId: d.patientId,
          serviceId: d.serviceId,
          programId: prog.id,
          programSequenceNumber: apt.sequenceNumber,
          status: "PENDING",
          createdBy: userId,
        },
      });
      await tx.appointment.create({
        data: {
          sessionId: session.id,
          therapistId: d.therapistId,
          date: new Date(apt.date),
          startTime: apt.startTime,
          endTime: apt.endTime,
          status: "SCHEDULED",
          scheduledBy: userId,
        },
      });
    }

    return prog;
  });

  return ok(program);
}
