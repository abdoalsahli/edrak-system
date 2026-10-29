import { NextResponse } from "next/server";
import { requireAuth, ok, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getBalances, naturalBalance } from "@/lib/ledger/LedgerService";

/**
 * رصيد الحساب الجاري للمريض — one figure for everything the patient was
 * charged and paid (programs, sessions, receipts). Payments are not tied to an invoice.
 * Financial data: managers and accountants only.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const patient = await prisma.patient.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!patient) return notFound();

  const account = await prisma.ledgerAccount.findUnique({ where: { patientId: params.id }, select: { id: true, nature: true } });
  if (!account) return ok({ accountId: null, balance: 0 });
  const t = (await getBalances(prisma, { accountIds: [account.id] })).get(account.id) ?? { debit: 0, credit: 0 };
  return ok({ accountId: account.id, balance: naturalBalance(account.nature, t.debit, t.credit) });
}
