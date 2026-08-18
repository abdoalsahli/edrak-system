import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, requireAuth, paginate } from "@/lib/api";
import { z } from "zod";

const createSchema = z.object({
  fullName: z.string().min(2),
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  nationalId: z.string().optional().nullable(),
  patientType: z.enum(["ADULT", "CHILD"]).default("ADULT"),
  guardian: z.object({
    fullName: z.string().min(2),
    relationship: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    nationalId: z.string().optional().nullable(),
  }).optional().nullable(),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { skip, take } = paginate(url.searchParams);
  const q = url.searchParams.get("q") ?? "";
  const active = url.searchParams.get("active");

  const where = {
    ...(active !== null ? { isActive: active === "true" } : {}),
    ...(q ? {
      OR: [
        { fullName: { contains: q } },
        { phone: { contains: q } },
        { nationalId: { contains: q } },
      ],
    } : {}),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { guardian: true },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.patient.count({ where }),
  ]);

  return ok({ data: patients, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const { guardian, ...data } = parsed.data;

  const patient = await prisma.patient.create({
    data: {
      ...data,
      dob: data.dob ? new Date(data.dob) : null,
      ...(guardian ? { guardian: { create: guardian } } : {}),
    },
    include: { guardian: true },
  });

  return ok(patient, 201);
}
