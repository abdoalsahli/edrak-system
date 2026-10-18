import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createSettlement, LedgerError } from "@/lib/ledger/LedgerService";

const CreateSchema = z
  .object({
    type: z.enum(["DISCOUNT", "WRITE_OFF", "CORRECTION", "TRANSFER", "OTHER"]),
    amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    debitAccountId: z.string().optional(),
    creditAccountId: z.string().optional(),
    description: z.string().min(1, "البيان مطلوب"),
    notes: z.string().optional(),
  })
  .refine((d) => d.debitAccountId || d.creditAccountId, {
    message: "اختر حساباً واحداً على الأقل",
    path: ["debitAccountId"],
  })
  .refine((d) => d.type !== "TRANSFER" || (d.debitAccountId && d.creditAccountId), {
    message: "التحويل يحتاج حساباً مديناً وحساباً دائناً",
    path: ["creditAccountId"],
  });

/** التسويات — non-cash adjustments to current accounts. */
export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const { skip, take } = paginate(searchParams, 100);

  const where = {
    ...(type ? { type: type as never } : {}),
    ...(from || to
      ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
      : {}),
  };

  const [rows, total, sum] = await Promise.all([
    prisma.settlement.findMany({
      where,
      include: {
        debitAccount: { select: { id: true, code: true, name: true } },
        creditAccount: { select: { id: true, code: true, name: true } },
        issuedByUser: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.settlement.count({ where }),
    prisma.settlement.aggregate({ where, _sum: { amount: true } }),
  ]);

  return NextResponse.json({ data: rows, total, totalAmount: Number(sum._sum.amount ?? 0) });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  try {
    const settlement = await prisma.$transaction((tx) =>
      createSettlement(tx, {
        type: d.type,
        amount: d.amount,
        date: d.date ? new Date(d.date) : undefined,
        debitAccountId: d.debitAccountId,
        creditAccountId: d.creditAccountId,
        description: d.description,
        notes: d.notes,
        issuedBy: auth.id,
      })
    );
    return ok(settlement, 201);
  } catch (e) {
    if (e instanceof LedgerError) return badRequest({ message: e.message });
    throw e;
  }
}
