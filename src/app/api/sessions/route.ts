import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { validateAvailability } from "@/lib/scheduling/SchedulingService";
import { z } from "zod";

const CreateSchema = z.object({
  patientId: z.string(),
  serviceId: z.string(),
  therapistId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomId: z.string().optional(),
  notes: z.string().optional(),
  isInsuranceCovered: z.boolean().default(false),
  insuranceProviderId: z.string().optional(),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");
  const { skip, take } = paginate(searchParams);

  const sessions = await prisma.session.findMany({
    where: {
      programId: null,
      ...(patientId ? { patientId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      patient: { select: { fullName: true } },
      service: { select: { name: true } },
      appointments: {
        where: { deletedAt: null },
        include: { therapist: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  const total = await prisma.session.count({
    where: {
      programId: null,
      ...(patientId ? { patientId } : {}),
      ...(status ? { status: status as never } : {}),
    },
  });

  return NextResponse.json({ data: sessions, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  const d = parsed.data;

  // Validate availability
  const check = await validateAvailability(d.therapistId, d.patientId, d.date, d.startTime, d.endTime);
  if (!check.ok) return badRequest({ message: check.reason });

  const session = await prisma.$transaction(async (tx) => {
    const s = await tx.session.create({
      data: {
        patientId: d.patientId,
        serviceId: d.serviceId,
        status: "PENDING",
        outcomeNotes: d.notes ?? null,
        createdBy: auth.id,
      },
    });
    await tx.appointment.create({
      data: {
        sessionId: s.id,
        therapistId: d.therapistId,
        roomId: d.roomId ?? null,
        date: new Date(d.date),
        startTime: d.startTime,
        endTime: d.endTime,
        status: "SCHEDULED",
        isInsuranceCovered: d.isInsuranceCovered,
        insuranceProviderId: d.insuranceProviderId ?? null,
        scheduledBy: auth.id,
      },
    });
    return s;
  });

  return ok(session);
}
