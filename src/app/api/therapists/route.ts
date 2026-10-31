import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, badRequest, requireAuth, paginate } from "@/lib/api";
import { z } from "zod";
import { setOpeningBalance } from "@/lib/ledger/LedgerService";

const schema = z.object({
  fullName:        z.string().min(2),
  specialty:       z.string().optional().nullable(),
  phone:           z.string().optional().nullable(),
  commissionType:  z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  commissionRate:  z.number().min(0).max(100).optional().nullable(),
  commissionFixed: z.number().min(0).optional().nullable(),
  // الرصيد الافتتاحي — in the account's direction; managers and accountants only
  openingBalance: z.object({
    amount: z.number(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  }).nullish(),
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
  const { openingBalance, ...data } = parsed.data;
  const therapist = await prisma.$transaction(async (tx) => {
    const t = await tx.therapist.create({ data, include: { availability: true } });
    if (openingBalance && Math.abs(openingBalance.amount) >= 0.005) {
      await setOpeningBalance(tx, { therapistId: t.id }, openingBalance.amount, openingBalance.date ? new Date(openingBalance.date) : null);
    }
    return t;
  });
  return ok(therapist, 201);
}
