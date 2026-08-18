import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest, requireAuth } from "@/lib/api";
import { z } from "zod";

const updateSchema = z.object({
  fullName: z.string().min(2).optional(),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  patientType: z.enum(["ADULT", "CHILD"]).optional(),
  isActive: z.boolean().optional(),
  guardian: z.object({
    fullName: z.string().min(2),
    relationship: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    nationalId: z.string().optional().nullable(),
  }).optional().nullable(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      guardian: true,
      programs: {
        include: { service: true, therapist: true },
        orderBy: { createdAt: "desc" },
      },
      sessions: {
        where: { programId: null },
        include: {
          service: true,
          appointments: { where: { deletedAt: null }, take: 1, orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      invoices: {
        where: { status: { not: "VOID" } },
        orderBy: { issueDate: "desc" },
        take: 5,
      },
    },
  });

  if (!patient) return notFound("المريض غير موجود");
  return ok(patient);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { guardian, ...data } = parsed.data;

  const existing = await prisma.patient.findUnique({ where: { id: params.id }, include: { guardian: true } });
  if (!existing) return notFound("المريض غير موجود");

  const patient = await prisma.patient.update({
    where: { id: params.id },
    data: {
      ...data,
      dob: data.dob ? new Date(data.dob) : data.dob === null ? null : undefined,
      ...(guardian !== undefined
        ? {
            guardian: existing.guardian
              ? { update: guardian ?? {} }
              : guardian
              ? { create: guardian }
              : { delete: true },
          }
        : {}),
    },
    include: { guardian: true },
  });

  return ok(patient);
}
