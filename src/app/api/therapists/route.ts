import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, requireAuth, paginate } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  fullName:        z.string().min(2),
  specialty:       z.string().optional().nullable(),
  phone:           z.string().optional().nullable(),
  commissionType:  z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  commissionRate:  z.number().min(0).max(100).optional().nullable(),
  commissionFixed: z.number().min(0).optional().nullable(),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const active = url.searchParams.get("active");
  const { skip, take } = paginate(url.searchParams);

  const therapists = await prisma.therapist.findMany({
    where: active !== null ? { isActive: active === "true" } : {},
    include: { availability: true },
    orderBy: { fullName: "asc" },
    skip,
    take,
  });
  return ok(therapists);
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);
  const therapist = await prisma.therapist.create({ data: parsed.data, include: { availability: true } });
  return ok(therapist, 201);
}
