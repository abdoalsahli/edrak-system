import Link from "next/link";
import type { AccountKind } from "@prisma/client";
import { getAccountBalances, type LedgerBalanceRow } from "@/lib/billing/TreasuryService";
import { PrintButton } from "./PrintButton";
import { Wallet, Landmark } from "lucide-react";

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_AR[m - 1]} ${y}`;
};
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SECTIONS: { kind: AccountKind; title: string; positive: string; negative: string }[] = [
  { kind: "PATIENT", title: "حسابات المرضى", positive: "عليه", negative: "له" },
  { kind: "THERAPIST", title: "حسابات الأخصائيين", positive: "له", negative: "عليه (سُلفة)" },
  { kind: "EXPENSE", title: "حسابات المصروفات", positive: "مصروف", negative: "مسترد" },
  { kind: "CUSTOM", title: "حسابات عامة", positive: "", negative: "" },
];

/** تقرير أرصدة الحسابات — every current account and cash account as of a date. */
export async function BalancesReport({ asOf, asOfIso }: { asOf: Date; asOfIso: string }) {
  const { groups, cashAccounts, totals } = await getAccountBalances(asOf);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">الأرصدة حتى تاريخ <strong>{fmtDate(asOfIso)}</strong></p>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">مستحق على المرضى</p>
          <p className="text-xl font-bold text-red-600 mt-1" dir="ltr">{money(totals.receivable)} د.ل</p>
          {totals.patientCredit > 0 && (
            <p className="text-xs text-amber-700 mt-1">أرصدة دائنة للمرضى: {money(totals.patientCredit)}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">مستحق للأخصائيين</p>
          <p className="text-xl font-bold text-amber-700 mt-1" dir="ltr">{money(totals.payable)} د.ل</p>
          {totals.therapistAdvance > 0 && (
            <p className="text-xs text-blue-700 mt-1">سُلف على الأخصائيين: {money(totals.therapistAdvance)}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">إجمالي المصروفات</p>
          <p className="text-xl font-bold text-gray-800 mt-1" dir="ltr">{money(totals.expenses)} د.ل</p>
        </div>
        <div className="card p-4 bg-primary-50 border-primary-200">
          <p className="text-xs text-primary-700">إجمالي أرصدة الصناديق</p>
          <p className="text-xl font-bold text-primary-800 mt-1" dir="ltr">{money(totals.cash)} د.ل</p>
        </div>
      </div>

      {SECTIONS.map((sec) => (
        <AccountSection key={sec.kind} title={sec.title} rows={groups[sec.kind]} positive={sec.positive} negative={sec.negative} asOfIso={asOfIso} />
      ))}

      {/* Cash */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">أرصدة الصناديق والحسابات البنكية</div>
        <table className="w-full text-sm">
          <tbody>
            {cashAccounts.map((a) => (
              <tr key={a.id} className={`border-t border-gray-50 ${!a.isActive ? "opacity-60" : ""}`}>
                <td className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">{a.type === "CASH" ? <Wallet className="size-4 text-gray-500" /> : <Landmark className="size-4 text-gray-500" />}{a.name}</span></td>
                <td className={`px-4 py-2.5 font-semibold ${a.balance < 0 ? "text-red-600" : "text-gray-800"}`} dir="ltr">
                  {money(a.balance)}
                </td>
                <td className="px-4 py-2.5 text-left">
                  <Link href={`/finance/cash-accounts/${a.id}?to=${asOfIso}`} className="text-xs text-primary-600 hover:underline">
                    الكشف ←
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
            <tr>
              <td className="px-4 py-2.5">الإجمالي</td>
              <td className="px-4 py-2.5 text-primary-800" dir="ltr">{money(totals.cash)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AccountSection({
  title, rows, positive, negative, asOfIso,
}: { title: string; rows: LedgerBalanceRow[]; positive: string; negative: string; asOfIso: string }) {
  if (rows.length === 0) return null;
  const sumDebit = rows.reduce((s, r) => s + r.debit, 0);
  const sumCredit = rows.reduce((s, r) => s + r.credit, 0);
  const sumBalance = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">
        {title} <span className="text-xs text-gray-400 font-normal">({rows.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-start font-medium">الرمز</th>
              <th className="px-4 py-2 text-start font-medium">الحساب</th>
              <th className="px-4 py-2 text-start font-medium">مدين</th>
              <th className="px-4 py-2 text-start font-medium">دائن</th>
              <th className="px-4 py-2 text-start font-medium">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-gray-50 hover:bg-gray-50/60 ${!r.isActive ? "opacity-60" : ""}`}>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500" dir="ltr">{r.code}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/finance/accounts/${r.id}?to=${asOfIso}`} className="text-primary-600 hover:underline font-medium">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5" dir="ltr">{money(r.debit)}</td>
                <td className="px-4 py-2.5" dir="ltr">{money(r.credit)}</td>
                <td className="px-4 py-2.5 font-semibold" dir="ltr">
                  <span className={r.balance > 0 ? "text-red-600" : r.balance < 0 ? "text-amber-700" : "text-gray-400"}>
                    {money(Math.abs(r.balance))}
                  </span>
                  <span className="text-xs font-normal text-gray-400 ms-1">
                    {r.balance > 0 ? positive || (r.nature === "DEBIT" ? "مدين" : "دائن") : r.balance < 0 ? negative || (r.nature === "DEBIT" ? "دائن" : "مدين") : ""}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
            <tr>
              <td className="px-4 py-2.5" colSpan={2}>الإجمالي</td>
              <td className="px-4 py-2.5" dir="ltr">{money(sumDebit)}</td>
              <td className="px-4 py-2.5" dir="ltr">{money(sumCredit)}</td>
              <td className="px-4 py-2.5" dir="ltr">{money(sumBalance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
