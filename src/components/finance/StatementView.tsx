"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { balanceTone } from "@/lib/balanceTone";

type Variant = "info" | "success" | "danger" | "warning" | "gray";

export type StatementEntry = {
  id: string;
  date: string;
  sourceType: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  href?: string | null;
};

const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; };
const money = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * كشف الحساب — a table on wide screens, a list of cards on phones. On a card
 * each movement shows as one signed amount in the account's own direction
 * (+ grows the balance, − lowers it) instead of separate debit/credit columns.
 */
export function StatementView({
  entries, totals, broughtForward, showBroughtForward, nature, sources, broughtForwardLabel = "رصيد أول المدة",
}: {
  entries: StatementEntry[];
  totals: { totalDebit: number; totalCredit: number; balance: number };
  broughtForward: number;
  showBroughtForward: boolean;
  /** The account's nature: DEBIT grows with debits, CREDIT with credits */
  nature: "DEBIT" | "CREDIT";
  sources: Record<string, { label: string; variant: Variant }>;
  broughtForwardLabel?: string;
}) {
  const change = (e: StatementEntry) => (nature === "DEBIT" ? e.debit - e.credit : e.credit - e.debit);
  const badge = (t: string) => sources[t] ?? { label: t, variant: "gray" as const };
  const describe = (e: StatementEntry) =>
    e.href ? <Link href={e.href} className="text-primary-600 hover:underline">{e.description}</Link> : e.description;

  return (
    <div className="card overflow-hidden">
      {/* ── Phones: one card per movement ─────────────────────────── */}
      <div className="md:hidden">
        {showBroughtForward && (
          <div className="flex items-center justify-between bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-500">{broughtForwardLabel}</span>
            <b dir="ltr">{money(broughtForward)}</b>
          </div>
        )}
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">لا توجد حركات في هذه الفترة</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {entries.map((e) => {
              const c = change(e);
              const b = badge(e.sourceType);
              return (
                <li key={e.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">{fmtDate(e.date)}</span>
                    <span className="flex items-center gap-1.5">
                      {e.reference && <span className="font-mono text-[11px] text-gray-400" dir="ltr">{e.reference}</span>}
                      <Badge variant={b.variant}>{b.label}</Badge>
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-800">{describe(e)}</p>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <span className="text-xs text-gray-400">
                      الرصيد بعدها: <b className={cn("font-semibold", balanceTone(nature, e.balance))} dir="ltr">{money(Math.abs(e.balance))}</b>
                    </span>
                    <span className={cn("text-base font-bold", c >= 0 ? "text-green-700" : "text-red-600")} dir="ltr">
                      {c >= 0 ? "+" : "−"}{money(Math.abs(c))}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {entries.length > 0 && (
          <div className="flex items-center justify-between border-t-2 border-gray-200 bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-500">الرصيد</span>
            <b className={cn("text-lg", balanceTone(nature, totals.balance))} dir="ltr">{money(Math.abs(totals.balance))}</b>
          </div>
        )}
      </div>

      {/* ── Wider screens: the ledger table ───────────────────────── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm" data-keep-table>
          <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2.5 text-start font-medium">التاريخ</th>
              <th className="px-4 py-2.5 text-start font-medium">النوع</th>
              <th className="px-4 py-2.5 text-start font-medium">البيان</th>
              <th className="px-4 py-2.5 text-start font-medium">مدين</th>
              <th className="px-4 py-2.5 text-start font-medium">دائن</th>
              <th className="px-4 py-2.5 text-start font-medium">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {showBroughtForward && (
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <td className="px-4 py-2.5 text-gray-500" colSpan={5}>{broughtForwardLabel}</td>
                <td className="px-4 py-2.5 font-semibold" dir="ltr">{money(broughtForward)}</td>
              </tr>
            )}
            {entries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">لا توجد حركات في هذه الفترة</td></tr>
            ) : (
              entries.map((e) => {
                const b = badge(e.sourceType);
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="whitespace-nowrap px-4 py-2.5">{fmtDate(e.date)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Badge variant={b.variant}>{b.label}</Badge>
                      {e.reference && <span className="ms-2 font-mono text-xs text-gray-400" dir="ltr">{e.reference}</span>}
                    </td>
                    <td className="min-w-[16rem] px-4 py-2.5">{describe(e)}</td>
                    <td className="px-4 py-2.5 text-red-600" dir="ltr">{e.debit ? money(e.debit) : "—"}</td>
                    <td className="px-4 py-2.5 text-green-700" dir="ltr">{e.credit ? money(e.credit) : "—"}</td>
                    <td className={cn("px-4 py-2.5 font-semibold", e.balance < 0 ? "text-red-600" : "text-gray-800")} dir="ltr">{money(e.balance)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
          {entries.length > 0 && (
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={3}>الإجمالي</td>
                <td className="px-4 py-3 text-red-600" dir="ltr">{money(totals.totalDebit)}</td>
                <td className="px-4 py-3 text-green-700" dir="ltr">{money(totals.totalCredit)}</td>
                <td className="px-4 py-3" dir="ltr">{money(totals.balance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
