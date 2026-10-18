"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { VoucherModal, type VoucherKind } from "@/components/finance/VoucherModal";

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
const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]}`; };

const DOC = {
  RECEIPT: { label: "سند قبض", variant: "success" as const, sign: "+" },
  PAYMENT: { label: "سند صرف", variant: "danger" as const, sign: "−" },
  SETTLEMENT: { label: "تسوية", variant: "gray" as const, sign: "" },
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

  if (!data) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;
  const t = data.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="لوحة المالية" description="الأرصدة في لمحة، وكل السندات من مكان واحد" />

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-4">
        {([
          ["receipt", "+ سند قبض", "استلام مبلغ على حساب مريض أو أي حساب", "border-green-200 hover:bg-green-50 text-green-800"],
          ["payment", "− سند صرف", "صرف لأخصائي، استرداد لمريض، أو مصروف", "border-red-200 hover:bg-red-50 text-red-800"],
          ["settlement", "⇄ تسوية", "خصم، إعدام دين، تصحيح، أو تحويل بين حسابين", "border-gray-200 hover:bg-gray-50 text-gray-800"],
        ] as [VoucherKind, string, string, string][]).map(([k, title, hint, cls]) => (
          <button key={k} onClick={() => setVoucher(k)} className={`card p-4 text-start border-2 transition-colors ${cls}`}>
            <p className="text-lg font-bold">{title}</p>
            <p className="text-xs opacity-75 mt-1">{hint}</p>
          </button>
        ))}
      </div>

      {/* Headline figures */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 bg-primary-50 border-primary-200">
          <p className="text-xs text-primary-700">النقد في الصناديق</p>
          <p className="text-xl font-bold text-primary-800 mt-1" dir="ltr">{money(t.cash)}</p>
        </div>
        <Link href="/finance/accounts?kind=PATIENT" className="card p-4 hover:bg-gray-50">
          <p className="text-xs text-gray-500">مستحق على المرضى</p>
          <p className="text-xl font-bold text-red-600 mt-1" dir="ltr">{money(t.receivable)}</p>
        </Link>
        <Link href="/finance/accounts?kind=THERAPIST" className="card p-4 hover:bg-gray-50">
          <p className="text-xs text-gray-500">مستحق للأخصائيين</p>
          <p className="text-xl font-bold text-amber-700 mt-1" dir="ltr">{money(t.payable)}</p>
        </Link>
        <div className="card p-4">
          <p className="text-xs text-gray-500">هذا الشهر: وارد / صادر</p>
          <p className="text-lg font-bold mt-1" dir="ltr">
            <span className="text-green-600">{money(t.monthIn)}</span>
            <span className="text-gray-300 mx-1">/</span>
            <span className="text-red-600">{money(t.monthOut)}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash boxes */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-sm">الصناديق والبنوك</h2>
            <Link href="/finance/cash" className="text-xs text-primary-600 hover:underline">إدارة ←</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {data.cashAccounts.map((b) => (
              <Link key={b.id} href={`/finance/accounts/${b.ledgerAccountId}`}
                className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${!b.isActive ? "opacity-50" : ""}`}>
                <span className="text-sm">{b.type === "CASH" ? "💵" : "🏦"} {b.name}</span>
                <span className={`font-semibold text-sm ${b.balance < 0 ? "text-red-600" : "text-gray-800"}`} dir="ltr">{money(b.balance)}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Latest documents */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm">آخر المستندات</div>
          {data.recent.length === 0 ? (
            <p className="text-sm text-gray-400 p-8 text-center">لا توجد مستندات بعد — ابدأ بسند قبض أو صرف</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {data.recent.map((r) => {
                  const d = DOC[r.kind];
                  return (
                    <tr key={r.kind + r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">{fmtDate(r.date)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge variant={d.variant}>{d.label}</Badge>
                        <span className="font-mono text-xs text-gray-400 ms-2" dir="ltr">{r.number}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.accountId ? (
                          <Link href={`/finance/accounts/${r.accountId}`} className="text-primary-600 hover:underline">{r.label}</Link>
                        ) : r.label}
                      </td>
                      <td className={`px-4 py-2.5 font-semibold text-left ${r.kind === "RECEIPT" ? "text-green-700" : r.kind === "PAYMENT" ? "text-red-600" : "text-gray-700"}`} dir="ltr">
                        {d.sign}{money(r.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
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
