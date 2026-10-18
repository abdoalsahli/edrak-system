import { NextResponse } from "next/server";
import { requireAuth, paginate, ok, badRequest } from "@/lib/api";
import { z } from "zod";
import { createReceipt, LedgerError } from "@/lib/ledger/LedgerService";
import { prisma } from "@/lib/prisma";

/**
 * سندات القبض — every amount received from patients.
 * Refunds are stored as negative receipts and are reported separately.
 */
export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const cashAccountId = searchParams.get("cashAccountId");
  const paymentMethodId = searchParams.get("paymentMethodId");
  const q = searchParams.get("q");
  const { skip, take } = paginate(searchParams);

  const where = {
    ...(cashAccountId ? { cashAccountId } : {}),
    ...(paymentMethodId ? { paymentMethodId } : {}),
    ...(q ? { account: { name: { contains: q } } } : {}),
    ...(from || to
      ? {
          paymentDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total, received, refunded] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true } },
        patient: { select: { id: true, fullName: true } },
        invoice: { select: { id: true, notes: true } },
        cashAccount: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
        receivedByUser: { select: { name: true } },
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      skip,
      take,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { ...where, amount: { gt: 0 } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { ...where, amount: { lt: 0 } }, _sum: { amount: true } }),
  ]);

  const totalReceived = Number(received._sum.amount ?? 0);
  const totalRefunded = Math.abs(Number(refunded._sum.amount ?? 0));

  return NextResponse.json({
    data: rows,
    total,
    skip,
    take,
    totals: {
      received: totalReceived,
      refunded: totalRefunded,
      net: totalReceived - totalRefunded,
    },
  });
}

const CreateSchema = z.object({
  accountId: z.string({ required_error: "اختر الحساب" }),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  paymentMethodId: z.string({ required_error: "اختر طريقة الدفع" }),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

/** سند قبض على أي حساب جارٍ. */
export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  try {
    const payment = await prisma.$transaction((tx) =>
      createReceipt(tx, {
        accountId: d.accountId,
        amount: d.amount,
        paymentMethodId: d.paymentMethodId,
        paymentDate: d.paymentDate ? new Date(d.paymentDate) : undefined,
        referenceNumber: d.referenceNumber,
        notes: d.notes,
        receivedBy: auth.id,
      })
    );
    return ok(payment, 201);
  } catch (e) {
    if (e instanceof LedgerError) return badRequest({ message: e.message });
    throw e;
  }
}
