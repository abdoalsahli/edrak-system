"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { VoucherModal, type VoucherKind } from "@/components/finance/VoucherModal";
import { StatCard } from "@/components/ui/StatCard";
import {
  ArrowDownCircle, ArrowUpCircle, Scale, ArrowLeftRight, Wallet, ReceiptText, HandCoins, Stethoscope, type LucideIcon,
} from "lucide-react";

type Overview = {
  totals: {
    receivable: number;
    patientCredit: number;
    payable: number;
    therapistAdvance: number;
    expenses: number;
    cash: number;
    monthIn: number;
    monthOut: number;
  };
  cashAccounts: { id: string; ledgerAccountId: string; name: string; type: "CASH" | "BANK"; isActive: boolean; balance: number }[];
  recent: {
    kind: "RECEIPT" | "PAYMENT" | "SETTLEMENT";
    id: string;
    number: string;
    date: string;
    amount: number;
    label: string;
    accountId: string | null;
  }[];
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DOC = {
  RECEIPT: { label: "قبض", variant: "success" as const },
  PAYMENT: { label: "صرف", variant: "danger" as const },
  SETTLEMENT: { label: "تسوية", variant: "warning" as const },
};

/** لوحة المالية — the place to start: balances at a glance and every voucher one click away. */
export default function FinanceDashboard() {
  const [data, setData] = useState<Overview | null>(null);
  const [voucher, setVoucher] = useState<VoucherKind | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/overview");
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="p-8 text-center text-gray-400">جارٍ التحميل...</div>;
  const t = data.totals;
  const boxes = data.cashAccounts.filter((b) => b.isActive);

  return (
    <div>
      <PageHeader title="المالية" description="نظام الحسابات الجارية — الأرصدة تُقرأ من القيود المرحّلة" />

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {([
          ["receipt", "سند قبض", ArrowDownCircle, "bg-green-100 text-green-500"],
          ["payment", "سند صرف", ArrowUpCircle, "bg-red-100 text-red-500"],
          ["settlement", "تسوية", Scale, "bg-amber-100 text-amber-500"],
        ] as [VoucherKind, string, LucideIcon, string][]).map(([k, title, Icon, tone]) => (
          <button key={k} onClick={() => setVoucher(k)} className="card flex flex-col items-center gap-3 p-5 transition hover:-translate-y-0.5">
            <span className={`grid size-14 place-items-center rounded-2xl ${tone}`}><Icon className="size-7" /></span>
            <span className="text-sm font-semibold text-gray-800">{title}</span>
          </button>
        ))}
        <Link href="/finance/cash" className="card flex flex-col items-center gap-3 p-5 transition hover:-translate-y-0.5">
          <span className="grid size-14 place-items-center rounded-2xl bg-cyan-100 text-cyan-500"><ArrowLeftRight className="size-7" /></span>
          <span className="text-sm font-semibold text-gray-800">تحويل بين صندوقين</span>
        </Link>
      </div>

      {/* Headline figures */}
      <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="المقبوض هذا الشهر" value={`${money(t.monthIn)} د.ل`} icon={Wallet} tone="success" />
        <StatCard label="المصروف هذا الشهر" value={`${money(t.monthOut)} د.ل`} icon={ReceiptText} tone="danger" />
        <Link href="/finance/accounts?kind=PATIENT" className="block transition hover:-translate-y-0.5">
          <StatCard label="المستحق على الحالات" value={`${money(t.receivable)} د.ل`} icon={HandCoins} tone="warning" />
        </Link>
        <Link href="/finance/accounts?kind=THERAPIST" className="block transition hover:-translate-y-0.5">
          <StatCard label="المستحق للأخصائيين" value={`${money(t.payable)} د.ل`} icon={Stethoscope} tone="primary" />
        </Link>
      </div>

      {/* min-w-0 lets the tables scroll inside their card instead of widening the page */}
      <div className="grid gap-5 xl:grid-cols-3 [&>*]:min-w-0">
        {/* Cash boxes — the first one highlighted */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-800">الصناديق</h2>
            <Link href="/finance/cash" className="text-sm text-primary-600 hover:underline">إدارة</Link>
          </div>
          <div className="space-y-3">
            {boxes.length === 0 && <p className="py-6 text-center text-sm text-gray-400">لا توجد صناديق</p>}
            {boxes.map((b, i) => (
              <Link
                key={b.id}
                href={`/finance/accounts/${b.ledgerAccountId}`}
                className={i === 0
                  ? "block rounded-2xl bg-gradient-primary p-5 text-white transition hover:opacity-95"
                  : "block rounded-2xl border border-gray-300 p-5 transition hover:bg-gray-50"}
              >
                <p className={i === 0 ? "text-sm opacity-80" : "text-sm text-gray-500"}>{b.type === "CASH" ? "صندوق" : "بنك"}</p>
                <p className="font-semibold">{b.name}</p>
                <p className={`mt-2 text-2xl font-bold ${i !== 0 && b.balance < 0 ? "text-red-600" : ""}`}>{money(b.balance)} د.ل</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Latest documents */}
        <section className="card p-5 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-800">آخر المستندات</h2>
            <Link href="/finance/receipts" className="text-sm text-primary-600 hover:underline">كل المستندات</Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">لا توجد مستندات بعد — ابدأ بسند قبض أو صرف</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-gray-500">
                    <th className="whitespace-nowrap px-3 py-3 text-start font-medium">الرقم</th>
                    <th className="whitespace-nowrap px-3 py-3 text-start font-medium">النوع</th>
                    <th className="whitespace-nowrap px-3 py-3 text-start font-medium">الطرف</th>
                    <th className="whitespace-nowrap px-3 py-3 text-start font-medium">المبلغ</th>
                    <th className="whitespace-nowrap px-3 py-3 text-start font-medium">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300/70">
                  {data.recent.map((r) => {
                    const d = DOC[r.kind];
                    return (
                      <tr key={r.kind + r.id}>
                        <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-800"><bdi>{r.number}</bdi></td>
                        <td className="px-3 py-3"><Badge variant={d.variant}>{d.label}</Badge></td>
                        <td className="px-3 py-3">
                          {r.accountId ? (
                            <Link href={`/finance/accounts/${r.accountId}`} className="text-gray-800 hover:text-primary-600">{r.label}</Link>
                          ) : r.label}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold text-gray-800">{money(r.amount)} د.ل</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-500"><bdi>{r.date.slice(0, 10)}</bdi></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <VoucherModal
        open={voucher !== null}
        kind={voucher ?? "receipt"}
        onClose={() => setVoucher(null)}
        onDone={(doc) => { load(); if (doc.voucherNumber) alert(`تم إصدار المستند رقم ${doc.voucherNumber}`); }}
      />
    </div>
  );
}
