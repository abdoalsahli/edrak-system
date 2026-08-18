import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest, requireAuth } from "@/lib/api";
import { z } from "zod";

const updateSchema = z.object({
  fullName:       z.string().min(2).optional(),
  specialty:      z.string().optional().nullable(),
  phone:          z.string().optional().nullable(),
  isActive:       z.boolean().optional(),
  commissionType:  z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  commissionRate:  z.number().min(0).max(100).optional().nullable(),
  commissionFixed: z.number().min(0).optional().nullable(),
  availability: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
  })).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const therapist = await prisma.therapist.findUnique({
    where: { id: params.id },
    include: {
      availability: { orderBy: { dayOfWeek: "asc" } },
      availabilityOverrides: { orderBy: { overrideDate: "asc" } },
    },
  });
  if (!therapist) return notFound("المعالج غير موجود");
  return ok(therapist);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { availability, ...data } = parsed.data;

  const existing = await prisma.therapist.findUnique({ where: { id: params.id } });
  if (!existing) return notFound("المعالج غير موجود");

  await prisma.$transaction(async (tx) => {
    await tx.therapist.update({ where: { id: params.id }, data });
    if (availability !== undefined) {
      await tx.therapistAvailability.deleteMany({ where: { therapistId: params.id } });
      if (availability.length > 0) {
        await tx.therapistAvailability.createMany({
          data: availability.map((a) => ({ ...a, therapistId: params.id })),
        });
      }
    }
  });

  const therapist = await prisma.therapist.findUnique({
    where: { id: params.id },
    include: { availability: { orderBy: { dayOfWeek: "asc" } } },
  });
  return ok(therapist);
}
