import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBalances, naturalBalance } from "@/lib/ledger/LedgerService";
import { PrintButton } from "@/app/(dashboard)/reports/PrintButton";
import { ReportFrame, defaultPeriod, requireFinanceRole } from "../ReportShell";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * عمولات الأخصائيين — per therapist: commissions earned (sessions delivered),
 * still expected (sessions not yet delivered), paid out, and the account balance.
 * Earned and paid are for the chosen period; expected and balance are as of today.
 */
export default async function CommissionsReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  await requireFinanceRole();
  const { from, to, fromIso, toIso } = defaultPeriod(searchParams);

  const [therapists, earned, expected, accounts] = await Promise.all([
    prisma.therapist.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true, isActive: true } }),
    prisma.therapistCommission.groupBy({
      by: ["therapistId"],
      where: { isEarned: true, createdAt: { gte: from, lte: new Date(to.getTime() + 86_399_999) } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.therapistCommission.groupBy({
      by: ["therapistId"],
      where: { isEarned: false },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.ledgerAccount.findMany({ where: { kind: "THERAPIST" }, select: { id: true, therapistId: true, nature: true } }),
  ]);

  const accountOf = new Map(accounts.map((a) => [a.therapistId!, a]));
  const [balances, paidRows] = await Promise.all([
    getBalances(prisma, { accountIds: accounts.map((a) => a.id) }),
    prisma.ledgerEntry.groupBy({
      by: ["accountId"],
      where: { accountId: { in: accounts.map((a) => a.id) }, sourceType: "PAYMENT", date: { gte: from, lte: to } },
      _sum: { debit: true },
    }),
  ]);
  const paidOf = new Map(paidRows.map((p) => [p.accountId, Number(p._sum.debit ?? 0)]));
  const earnedOf = new Map(earned.map((e) => [e.therapistId, { amount: Number(e._sum.amount ?? 0), count: e._count._all }]));
  const expectedOf = new Map(expected.map((e) => [e.therapistId, { amount: Number(e._sum.amount ?? 0), count: e._count._all }]));

  const rows = therapists.map((t) => {
    const acc = accountOf.get(t.id);
    const sums = acc ? balances.get(acc.id) ?? { debit: 0, credit: 0 } : { debit: 0, credit: 0 };
    return {
      ...t,
      accountId: acc?.id ?? null,
      earned: earnedOf.get(t.id) ?? { amount: 0, count: 0 },
      expected: expectedOf.get(t.id) ?? { amount: 0, count: 0 },
      paid: acc ? paidOf.get(acc.id) ?? 0 : 0,
      balance: acc ? naturalBalance(acc.nature, sums.debit, sums.credit) : 0,
    };
  });

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0);

  return (
    <ReportFrame title="عمولات الأخصائيين" description="المحقّق والمتوقّع والمصروف ورصيد كل أخصائي" fromIso={fromIso} toIso={toIso}>
      <div className="flex justify-end mb-3"><PrintButton /></div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">الأخصائي</th>
                <th className="px-4 py-2.5 text-start font-medium">محقّقة في الفترة</th>
                <th className="px-4 py-2.5 text-start font-medium">مصروف في الفترة</th>
                <th className="px-4 py-2.5 text-start font-medium">متوقّعة (لم تُقدَّم)</th>
                <th className="px-4 py-2.5 text-start font-medium">رصيد الحساب اليوم</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${!r.isActive ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2.5">
                    <Link href={r.accountId ? `/finance/accounts/${r.accountId}` : `/finance/accounts/therapist:${r.id}`}
                      className="text-primary-600 hover:underline font-medium">{r.fullName}</Link>
                  </td>
                  <td className="px-4 py-2.5" dir="ltr">
                    {money(r.earned.amount)} <span className="text-xs text-gray-400">({r.earned.count})</span>
                  </td>
                  <td className="px-4 py-2.5 text-red-600" dir="ltr">{money(r.paid)}</td>
                  <td className="px-4 py-2.5 text-gray-500" dir="ltr">
                    {money(r.expected.amount)} <span className="text-xs text-gray-400">({r.expected.count})</span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold" dir="ltr">
                    <span className={r.balance > 0 ? "text-amber-700" : r.balance < 0 ? "text-blue-700" : "text-gray-400"}>{money(Math.abs(r.balance))}</span>
                    <span className="text-xs font-normal text-gray-400 ms-1">{r.balance > 0 ? "له" : r.balance < 0 ? "عليه (سُلفة)" : ""}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3">الإجمالي</td>
                <td className="px-4 py-3" dir="ltr">{money(sum((r) => r.earned.amount))}</td>
                <td className="px-4 py-3 text-red-600" dir="ltr">{money(sum((r) => r.paid))}</td>
                <td className="px-4 py-3 text-gray-500" dir="ltr">{money(sum((r) => r.expected.amount))}</td>
                <td className="px-4 py-3" dir="ltr">{money(sum((r) => r.balance))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">
        المحقّقة = عمولات جلسات قُدِّمت. المتوقّعة = عمولات جلسات برامج لم تُقدَّم بعد، ولا تدخل في الرصيد حتى تُقدَّم أو تُلغى.
        الصرف يتم من حساب الأخصائي بسند صرف.
      </p>
    </ReportFrame>
  );
}
