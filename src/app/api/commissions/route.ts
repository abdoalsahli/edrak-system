import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.discriminatedUnion("commissionType", [
  z.object({
    commissionType: z.literal("PERCENTAGE"),
    therapistId: z.string(),
    sessionId:   z.string(),
    baseAmount:  z.number().positive(),
    rate:        z.number().min(0).max(100),
  }),
  z.object({
    commissionType: z.literal("FIXED"),
    therapistId: z.string(),
    sessionId:   z.string(),
    amount:      z.number().positive(),
  }),
]);

export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const therapistId = searchParams.get("therapistId");
  const isPaid      = searchParams.get("isPaid");
  const from        = searchParams.get("from");
  const to          = searchParams.get("to");

  const commissions = await prisma.therapistCommission.findMany({
    where: {
      ...(therapistId ? { therapistId } : {}),
      ...(isPaid !== null ? { isPaid: isPaid === "true" } : {}),
      ...(from || to ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to + "T23:59:59") } : {}),
        },
      } : {}),
    },
    include: {
      therapist: { select: { id: true, fullName: true } },
      session: {
        include: {
          patient: { select: { fullName: true } },
          service: { select: { name: true } },
        },
      },
      paidByUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalUnpaid = commissions
    .filter(c => !c.isPaid)
    .reduce((s, c) => s + Number(c.amount), 0);

  const totalPaid = commissions
    .filter(c => c.isPaid)
    .reduce((s, c) => s + Number(c.amount), 0);

  return ok({ commissions, totalUnpaid, totalPaid });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.errors[0].message);

  const d = parsed.data;
  const isPercentage = d.commissionType === "PERCENTAGE";
  const amount       = isPercentage ? (d.baseAmount * d.rate) / 100 : d.amount;
  const upsertData   = isPercentage
    ? { commissionType: "PERCENTAGE" as const, rate: d.rate, baseAmount: d.baseAmount, amount }
    : { commissionType: "FIXED"      as const, rate: null,   baseAmount: null,         amount };

  const commission = await prisma.therapistCommission.upsert({
    where:  { sessionId: d.sessionId },
    update: upsertData,
    create: { therapistId: d.therapistId, sessionId: d.sessionId, ...upsertData },
  });

  return ok(commission, 201);
}
