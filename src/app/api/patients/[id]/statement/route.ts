import { NextResponse } from "next/server";
import { requireAuth, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAccountStatement, getPatientAccountId } from "@/lib/ledger/LedgerService";

/**
 * كشف حساب المريض — now read straight from the patient's current account.
 * Kept for existing links; the statement itself lives in the ledger.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const patient = await prisma.patient.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!patient) return notFound();

  const accountId = await prisma.$transaction((tx) => getPatientAccountId(tx, params.id));

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const statement = await getAccountStatement(prisma, accountId, from ? new Date(from) : null, to ? new Date(to) : null);
  if (!statement) return notFound();

  return NextResponse.json({ accountId, ...statement });
}
