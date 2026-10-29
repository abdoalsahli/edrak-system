import { NextResponse } from "next/server";
import { requireAuth, therapistIdOf, badRequest, forbidden } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getAccountStatement, getTherapistAccountId } from "@/lib/ledger/LedgerService";

const isDate = (s: string | null) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * كشف حسابي — the signed-in therapist's own current account, plus where the
 * commission stands (earned on delivered sessions vs. recorded ahead for
 * programme sessions not yet held).
 */
export async function GET(req: Request) {
  const auth = await requireAuth(["THERAPIST"]);
  if (auth instanceof NextResponse) return auth;
  const therapistId = await therapistIdOf(auth.id);
  if (!therapistId) return forbidden();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!isDate(from) || !isDate(to)) return badRequest({ message: "تاريخ غير صالح" });

  const accountId = await prisma.$transaction((tx) => getTherapistAccountId(tx, therapistId));
  const statement = await getAccountStatement(prisma, accountId, from ? new Date(from) : null, to ? new Date(to) : null);
  if (!statement) return forbidden();

  const [earned, ahead] = await Promise.all([
    prisma.therapistCommission.aggregate({ where: { therapistId, isEarned: true, isPaid: false }, _sum: { amount: true }, _count: true }),
    prisma.therapistCommission.aggregate({ where: { therapistId, isEarned: false, isPaid: false }, _sum: { amount: true }, _count: true }),
  ]);

  return NextResponse.json({
    account: { code: statement.account.code, name: statement.account.name },
    broughtForward: statement.broughtForward,
    totals: statement.totals,
    // Staff pages behind each entry are not part of the portal
    entries: statement.entries.map(({ href: _href, sourceId: _sourceId, ...e }) => e),
    commissions: {
      earned: { amount: Number(earned._sum.amount ?? 0), sessions: earned._count },
      ahead: { amount: Number(ahead._sum.amount ?? 0), sessions: ahead._count },
    },
  });
}
