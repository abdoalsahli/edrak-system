import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getAccountBalances } from "@/lib/billing/TreasuryService";
import { createCashAccount, getBalances } from "@/lib/ledger/LedgerService";

const CreateSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  type: z.enum(["CASH", "BANK"]),
  accountNumber: z.string().optional(),
  openingBalance: z.number().default(0),
  notes: z.string().optional(),
});

/**
 * Cash boxes and bank accounts. Each is a ledger account, so its balance is the
 * balance of that account: debits (money in) − credits (money out).
 */
export async function GET() {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { cashAccounts } = await getAccountBalances(new Date());
  const boxes = await prisma.cashAccount.findMany();
  const boxOf = new Map(boxes.map((b) => [b.id, b]));
  const sums = await getBalances(prisma, { accountIds: cashAccounts.map((c) => c.ledgerAccountId) });

  const data = cashAccounts.map((c) => {
    const box = boxOf.get(c.id)!;
    const t = sums.get(c.ledgerAccountId) ?? { debit: 0, credit: 0 };
    return {
      id: c.id,
      ledgerAccountId: c.ledgerAccountId,
      name: c.name,
      type: c.type,
      accountNumber: box.accountNumber,
      openingBalance: Number(box.openingBalance),
      isActive: c.isActive,
      totalIn: t.debit,
      totalOut: t.credit,
      balance: c.balance,
    };
  });

  return NextResponse.json({
    data,
    totals: {
      balance: data.filter((a) => a.isActive).reduce((s, a) => s + a.balance, 0),
      totalIn: data.reduce((s, a) => s + a.totalIn, 0),
      totalOut: data.reduce((s, a) => s + a.totalOut, 0),
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  // The box, its ledger account and its opening entry are created together
  const box = await prisma.$transaction((tx) => createCashAccount(tx, parsed.data));
  return ok(box, 201);
}
