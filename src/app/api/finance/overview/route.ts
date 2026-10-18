import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAccountBalances } from "@/lib/billing/TreasuryService";

/** لوحة المالية — headline figures and the latest documents. */
export async function GET() {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const take = 12;

  const [balances, monthIn, monthOut, receipts, payments, settlements] = await Promise.all([
    getAccountBalances(now),
    prisma.payment.aggregate({ where: { paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.disbursement.aggregate({ where: { paymentDate: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" }, take,
      select: { id: true, voucherNumber: true, paymentDate: true, amount: true, createdAt: true, accountId: true, account: { select: { name: true } } },
    }),
    prisma.disbursement.findMany({
      orderBy: { createdAt: "desc" }, take,
      select: { id: true, voucherNumber: true, paymentDate: true, amount: true, createdAt: true, accountId: true, account: { select: { name: true } } },
    }),
    prisma.settlement.findMany({
      orderBy: { createdAt: "desc" }, take,
      select: { id: true, voucherNumber: true, date: true, amount: true, createdAt: true, description: true },
    }),
  ]);

  const recent = [
    ...receipts.map((r) => ({
      kind: "RECEIPT" as const, id: r.id, number: r.voucherNumber, date: r.paymentDate, createdAt: r.createdAt,
      amount: Number(r.amount), label: r.account?.name ?? "—", accountId: r.accountId,
    })),
    ...payments.map((p) => ({
      kind: "PAYMENT" as const, id: p.id, number: p.voucherNumber, date: p.paymentDate, createdAt: p.createdAt,
      amount: Number(p.amount), label: p.account?.name ?? "—", accountId: p.accountId,
    })),
    ...settlements.map((s) => ({
      kind: "SETTLEMENT" as const, id: s.id, number: s.voucherNumber, date: s.date, createdAt: s.createdAt,
      amount: Number(s.amount), label: s.description, accountId: null,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, take);

  return NextResponse.json({
    totals: {
      ...balances.totals,
      monthIn: Number(monthIn._sum.amount ?? 0),
      monthOut: Number(monthOut._sum.amount ?? 0),
    },
    cashAccounts: balances.cashAccounts,
    recent,
  });
}
