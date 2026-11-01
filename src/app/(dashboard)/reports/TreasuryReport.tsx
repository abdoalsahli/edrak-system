import Link from "next/link";
import { getTreasuryMovement } from "@/lib/billing/TreasuryService";
import { Badge } from "@/components/ui/Badge";
import { PrintButton } from "./PrintButton";
import { Wallet, Landmark } from "lucide-react";

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_AR[m - 1]} ${y}`;
};
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cell = (n: number) => (n === 0 ? "—" : money(n));

const DISB_TYPE_AR: Record<string, string> = {
  COMMISSION: "عمولات الأخصائيين",
  EXPENSE: "مصروفات تشغيلية",
  SALARY: "رواتب",
  REFUND: "استردادات (سندات صرف)",
  OTHER: "مصروفات أخرى",
};

const CATEGORY_AR: Record<string, string> = {
  RENT: "إيجار", SALARIES: "رواتب", UTILITIES: "خدمات", SUPPLIES: "مستلزمات",
  MAINTENANCE: "صيانة", MARKETING: "تسويق", GOVERNMENT: "رسوم حكومية", OTHER: "أخرى",
};

const TYPE_BADGE = {
  OPENING: { label: "افتتاحي", variant: "gray" as const },
  RECEIPT: { label: "قبض", variant: "success" as const },
  DISBURSEMENT: { label: "صرف", variant: "danger" as const },
  TRANSFER: { label: "تحويل داخلي", variant: "gray" as const },
  SETTLEMENT: { label: "تسوية", variant: "info" as const },
};

/** تقرير حركة الخزينة — every movement across all cash accounts for a period. */
export async function TreasuryReport({ from, to, fromIso, toIso }: { from: Date; to: Date; fromIso: string; toIso: string }) {
  const { broughtForward, entries, totals, byAccount, breakdown } = await getTreasuryMovement({ from, to });

  const disbursementRows = Object.entries(breakdown.byDisbursementType);
  const settlementsIn = Object.entries(breakdown.settlementsIn);
  const settlementsOut = Object.entries(breakdown.settlementsOut);
  // Each transfer posts on two boxes; count the transfers, not their two sides
  // The per-box table adds up its own rows (they include transfers between boxes)
  const boxIn = byAccount.reduce((s, a) => s + a.totalIn, 0);
  const boxOut = byAccount.reduce((s, a) => s + a.totalOut, 0);
  const detailIn = entries.reduce((s, e) => s + e.in, 0);
  const detailOut = entries.reduce((s, e) => s + e.out, 0);
  const internalCount = new Set(entries.filter((e) => e.internal).map((e) => e.voucherNumber)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          الفترة من <strong>{fmtDate(fromIso)}</strong> إلى <strong>{fmtDate(toIso)}</strong> — جميع الصناديق والحسابات
        </p>
        <PrintButton />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">رصيد أول المدة</p>
          <p className="text-xl font-bold text-gray-800 mt-1" dir="ltr">{money(broughtForward)} د.ل</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">إجمالي الوارد</p>
          <p className="text-xl font-bold text-green-600 mt-1" dir="ltr">{money(totals.totalIn)} د.ل</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">إجمالي الصادر</p>
          <p className="text-xl font-bold text-red-600 mt-1" dir="ltr">{money(totals.totalOut)} د.ل</p>
        </div>
        <div className="card p-4 bg-primary-50 border-primary-200">
          <p className="text-xs text-primary-700">رصيد آخر المدة</p>
          <p className="text-xl font-bold text-primary-800 mt-1" dir="ltr">{money(totals.closingBalance)} د.ل</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Breakdown by kind */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">تحليل الحركة حسب النوع</div>
          <table className="w-full text-sm">
            <tbody>
              <tr className="bg-green-50/50">
                <td className="px-4 py-2 font-medium text-green-800" colSpan={2}>الوارد</td>
              </tr>
              <tr className="border-t border-gray-50">
                <td className="px-4 py-2 ps-8">سندات قبض</td>
                <td className="px-4 py-2 text-green-700 font-medium" dir="ltr">{money(breakdown.receipts)}</td>
              </tr>
              {breakdown.openings !== 0 && (
                <tr className="border-t border-gray-50">
                  <td className="px-4 py-2 ps-8">أرصدة افتتاحية</td>
                  <td className="px-4 py-2 text-green-700" dir="ltr">{money(breakdown.openings)}</td>
                </tr>
              )}
              {/* Settlements into the treasury: stock-count surplus, transfers from outside, … */}
              {settlementsIn.map(([label, amount]) => (
                <tr key={"in" + label} className="border-t border-gray-50">
                  <td className="px-4 py-2 ps-8">{label}</td>
                  <td className="px-4 py-2 text-green-700" dir="ltr">{money(amount)}</td>
                </tr>
              ))}

              <tr className="bg-red-50/50 border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-red-800" colSpan={2}>الصادر</td>
              </tr>
              {/* Settlements out of the treasury: profits withdrawn, stock-count shortage, … */}
              {settlementsOut.map(([label, amount]) => (
                <tr key={"out" + label} className="border-t border-gray-50">
                  <td className="px-4 py-2 ps-8">{label}</td>
                  <td className="px-4 py-2 text-red-600" dir="ltr">{money(amount)}</td>
                </tr>
              ))}
              {disbursementRows.length === 0 && settlementsOut.length === 0 && (
                <tr className="border-t border-gray-50">
                  <td className="px-4 py-2 ps-8 text-gray-400" colSpan={2}>لا توجد سندات صرف في هذه الفترة</td>
                </tr>
              )}
              {disbursementRows.map(([type, amount]) => (
                <tr key={type} className="border-t border-gray-50">
                  <td className="px-4 py-2 ps-8">
                    {DISB_TYPE_AR[type] ?? type}
                    {type === "EXPENSE" && Object.keys(breakdown.byExpenseCategory).length > 0 && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {Object.entries(breakdown.byExpenseCategory)
                          .map(([c, v]) => `${CATEGORY_AR[c] ?? c}: ${money(v)}`)
                          .join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-red-600 align-top" dir="ltr">{money(amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              {internalCount > 0 && (
                <tr>
                  <td className="px-4 py-2 text-xs font-normal text-gray-500" colSpan={2}>
                    التحويلات بين الصناديق والحسابات البنكية ({internalCount === 1 ? "تحويل واحد" : `${internalCount} تحويلات`}) لا تُحسب هنا — المال بقي في الخزينة.
                  </td>
                </tr>
              )}
              <tr>
                <td className="px-4 py-2.5">صافي حركة الفترة</td>
                <td className={`px-4 py-2.5 ${totals.totalIn - totals.totalOut < 0 ? "text-red-600" : "text-green-700"}`} dir="ltr">
                  {money(totals.totalIn - totals.totalOut)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Per account */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">الحركة حسب الصندوق</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-start font-medium" data-card="title">الحساب</th>
                  <th className="px-3 py-2 text-start font-medium">أول المدة</th>
                  <th className="px-3 py-2 text-start font-medium" data-hide-mobile>وارد</th>
                  <th className="px-3 py-2 text-start font-medium" data-hide-mobile>صادر</th>
                  <th className="hidden" data-show-mobile>صافي الحركة</th>
                  <th className="px-3 py-2 text-start font-medium" data-card="amount">آخر المدة</th>
                </tr>
              </thead>
              <tbody>
                {byAccount.map((a) => (
                  <tr key={a.id} className="border-t border-gray-50">
                    <td className="px-3 py-2">
                      <Link
                        href={`/finance/cash-accounts/${a.id}?from=${fromIso}&to=${toIso}`}
                        className="text-primary-600 hover:underline"
                      >
                        <span className="inline-flex items-center gap-2">{a.type === "CASH" ? <Wallet className="size-4 text-gray-500" /> : <Landmark className="size-4 text-gray-500" />}{a.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2" dir="ltr">{money(a.broughtForward)}</td>
                    <td className="px-3 py-2 text-green-700" dir="ltr">{cell(a.totalIn)}</td>
                    <td className="px-3 py-2 text-red-600" dir="ltr">{cell(a.totalOut)}</td>
                    <td className={`hidden font-semibold ${a.totalIn - a.totalOut >= 0 ? "text-green-700" : "text-red-600"}`} dir="ltr">{a.totalIn - a.totalOut >= 0 ? "+" : "−"}{money(Math.abs(a.totalIn - a.totalOut))}</td>
                    <td className="px-3 py-2 font-semibold" dir="ltr">{money(a.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                <tr>
                  <td className="px-3 py-2.5">الإجمالي</td>
                  <td className="px-3 py-2.5" dir="ltr">{money(broughtForward)}</td>
                  <td className="px-3 py-2.5 text-green-700" dir="ltr">{money(boxIn)}</td>
                  <td className="px-3 py-2.5 text-red-600" dir="ltr">{money(boxOut)}</td>
                  <td className={`hidden font-semibold ${boxIn - boxOut >= 0 ? "text-green-700" : "text-red-600"}`} dir="ltr">{boxIn - boxOut >= 0 ? "+" : "−"}{money(Math.abs(boxIn - boxOut))}</td>
                  <td className="px-3 py-2.5 text-primary-800" dir="ltr">{money(totals.closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Full ledger */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">
          تفاصيل الحركة <span className="text-xs text-gray-400 font-normal">({entries.length} حركة)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 text-start font-medium" data-card="meta">التاريخ</th>
                <th className="px-4 py-2 text-start font-medium" data-card="meta">المستند</th>
                <th className="px-4 py-2 text-start font-medium" data-card="title">البيان</th>
                <th className="px-4 py-2 text-start font-medium">الصندوق</th>
                <th className="px-4 py-2 text-start font-medium" data-hide-mobile>وارد</th>
                <th className="px-4 py-2 text-start font-medium" data-hide-mobile>صادر</th>
                <th className="hidden" data-show-mobile data-card="amount">المبلغ</th>
                <th className="px-4 py-2 text-start font-medium">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-gray-50/60 border-b border-gray-100">
                <td className="px-4 py-2.5 text-gray-500" colSpan={6}>رصيد أول المدة</td>
                <td className="hidden" />
                <td className="px-4 py-2.5 font-semibold" dir="ltr">{money(broughtForward)}</td>
              </tr>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">لا توجد حركات في هذه الفترة</td>
                </tr>
              ) : (
                entries.map((e, i) => {
                  const b = TYPE_BADGE[e.type];
                  return (
                    <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge variant={b.variant}>{b.label}</Badge>
                        <span className="font-mono text-xs text-gray-500 ms-2" dir="ltr">{e.voucherNumber}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {e.description}
                        {e.expenseCategory && (
                          <span className="text-xs text-gray-400 ms-2">({CATEGORY_AR[e.expenseCategory] ?? e.expenseCategory})</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">{e.accountName}</td>
                      <td className="px-4 py-2.5 text-green-700" dir="ltr">{cell(e.in)}</td>
                      <td className="px-4 py-2.5 text-red-600" dir="ltr">{cell(e.out)}</td>
                      <td className={`hidden font-semibold ${e.in ? "text-green-700" : "text-red-600"}`} dir="ltr">
                        {e.in ? `+${money(e.in)}` : `−${money(e.out)}`}
                      </td>
                      <td className={`px-4 py-2.5 font-semibold ${e.balance < 0 ? "text-red-600" : "text-gray-800"}`} dir="ltr">
                        {money(e.balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold border-t-2 border-gray-200">
              <tr>
                <td className="px-4 py-3" colSpan={4}>الإجمالي</td>
                <td className="px-4 py-3 text-green-700" dir="ltr">{money(detailIn)}</td>
                <td className="px-4 py-3 text-red-600" dir="ltr">{money(detailOut)}</td>
                <td className="hidden" />
                <td className="px-4 py-3 text-primary-800" dir="ltr">{money(totals.closingBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
