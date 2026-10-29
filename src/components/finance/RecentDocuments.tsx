import Link from "next/link";
import type { RecentDocument } from "@/lib/billing/TreasuryService";

const PREFIX: Record<RecentDocument["kind"], string> = { RECEIPT: "قبض", PAYMENT: "صرف", SETTLEMENT: "تسوية" };
const money = (n: number) => Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

/** «آخر المستندات» — compact list: party, number · date, signed amount. */
export function RecentDocuments({ docs, title = "آخر المستندات", moreHref = "/finance/receipts" }: {
  docs: RecentDocument[];
  title?: string;
  moreHref?: string;
}) {
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        <Link href={moreHref} className="text-sm text-primary-600 hover:underline">عرض الكل</Link>
      </div>
      {docs.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">لا توجد مستندات بعد</p>
      ) : (
        <ul className="space-y-4">
          {docs.map((d) => (
            <li key={`${d.kind}-${d.id}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{d.party}</p>
                <p className="whitespace-nowrap text-xs text-gray-500">
                  {PREFIX[d.kind]} <bdi>{d.voucherNumber}</bdi> · <bdi>{d.date}</bdi>
                </p>
              </div>
              <span
                className={`shrink-0 whitespace-nowrap text-sm font-semibold ${
                  d.kind === "SETTLEMENT" ? "text-gray-500" : d.amount >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {d.kind === "SETTLEMENT" ? "" : d.amount >= 0 ? "+" : "−"}{money(d.amount)} د.ل
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
