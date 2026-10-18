import { NextResponse } from "next/server";
import { requireAuth, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const r2 = (n: number) => Math.round(n * 100) / 100;

type Entry = {
  date: string;
  type: "EARNED" | "PAID";
  reference: string;   // voucher number for a payout
  description: string;
  credit: number;      // دائن — owed to the therapist (a delivered session)
  debit: number;       // مدين — paid out to the therapist
  balance: number;     // running balance: > 0 the centre owes, < 0 the therapist owes back
  sessionId: string | null;
};

/**
 * كشف حساب الأخصائي — a running account, not a per-session settlement.
 *
 * Credits are commissions of sessions actually delivered; debits are the
 * amounts paid out. Any amount may be paid at any time, so the balance can be
 * positive (due to the therapist) or negative (an advance he still has to earn).
 * Commissions accrued for sessions not yet delivered are reported separately as
 * "expected" and deliberately kept out of the balance.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const therapist = await prisma.therapist.findUnique({
    where: { id: params.id },
    select: { id: true, fullName: true, specialty: true, phone: true },
  });
  if (!therapist) return notFound();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const inRange = (field: string) =>
    fromDate || toDate
      ? { [field]: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {};

  const [earned, expectedAgg, payouts, earnedBeforeAgg, paidBeforeAgg] = await Promise.all([
    prisma.therapistCommission.findMany({
      where: { therapistId: params.id, isEarned: true, ...inRange("createdAt") },
      select: {
        id: true, amount: true, createdAt: true, sessionId: true,
        session: {
          select: {
            patient: { select: { fullName: true } },
            service: { select: { name: true } },
            programSequenceNumber: true,
          },
        },
      },
    }),
    prisma.therapistCommission.aggregate({
      where: { therapistId: params.id, isEarned: false },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.disbursement.findMany({
      where: { therapistId: params.id, type: { in: ["COMMISSION", "SALARY"] }, ...inRange("paymentDate") },
      select: {
        id: true, voucherNumber: true, amount: true, paymentDate: true,
        createdAt: true, description: true, cashAccount: { select: { name: true } },
      },
    }),
    fromDate
      ? prisma.therapistCommission.aggregate({
          where: { therapistId: params.id, isEarned: true, createdAt: { lt: fromDate } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
    fromDate
      ? prisma.disbursement.aggregate({
          where: { therapistId: params.id, type: { in: ["COMMISSION", "SALARY"] }, paymentDate: { lt: fromDate } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: null } }),
  ]);

  const broughtForward = r2(
    Number(earnedBeforeAgg._sum.amount ?? 0) - Number(paidBeforeAgg._sum.amount ?? 0)
  );

  const rows: (Entry & { sortAt: Date })[] = [];

  for (const c of earned) {
    const seq = c.session?.programSequenceNumber;
    rows.push({
      date: c.createdAt.toISOString().slice(0, 10),
      type: "EARNED",
      reference: "—",
      description:
        `عمولة جلسة — ${c.session?.patient.fullName ?? ""}` +
        (c.session?.service.name ? ` · ${c.session.service.name}` : "") +
        (seq ? ` (#${seq})` : ""),
      credit: Number(c.amount),
      debit: 0,
      balance: 0,
      sessionId: c.sessionId,
      sortAt: c.createdAt,
    });
  }

  for (const p of payouts) {
    rows.push({
      date: p.paymentDate.toISOString().slice(0, 10),
      type: "PAID",
      reference: p.voucherNumber,
      description: `${p.description}${p.cashAccount?.name ? ` · ${p.cashAccount.name}` : ""}`,
      credit: 0,
      debit: Number(p.amount),
      balance: 0,
      sessionId: null,
      sortAt: p.createdAt,
    });
  }

  rows.sort((a, b) =>
    a.date !== b.date ? a.date.localeCompare(b.date) : a.sortAt.getTime() - b.sortAt.getTime()
  );

  let running = broughtForward;
  const entries: Entry[] = rows.map(({ sortAt: _sortAt, ...e }) => {
    running += e.credit - e.debit;
    return { ...e, balance: r2(running) };
  });

  const totalEarned = r2(entries.reduce((s, e) => s + e.credit, 0));
  const totalPaid = r2(entries.reduce((s, e) => s + e.debit, 0));

  return NextResponse.json({
    therapist,
    broughtForward,
    entries,
    totals: {
      totalEarned,
      totalPaid,
      balance: r2(broughtForward + totalEarned - totalPaid),
      expected: r2(Number(expectedAgg._sum.amount ?? 0)),
      expectedCount: expectedAgg._count._all,
    },
  });
}
