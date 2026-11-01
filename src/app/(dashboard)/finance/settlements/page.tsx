"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, DOCUMENT_TABS } from "@/components/ui/SectionTabs";
import { Badge } from "@/components/ui/Badge";
import { VoucherModal } from "@/components/finance/VoucherModal";

type AccountRef = { id: string; code: string; name: string } | null;
type Settlement = {
  id: string;
  voucherNumber: string;
  type: string;
  date: string;
  amount: number;
  description: string;
  debitAccount: AccountRef;
  creditAccount: AccountRef;
  issuedByUser: { name: string };
};

const TYPE_AR: Record<string, string> = {
  DISCOUNT: "خصم",
  WRITE_OFF: "إعدام دين",
  CORRECTION: "تصحيح",
  TRANSFER: "تحويل",
  OTHER: "أخرى",
};

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; };
const money = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function AccountLink({ a }: { a: AccountRef }) {
  if (!a) return <span className="text-gray-300">—</span>;
  return (
    <Link href={`/finance/accounts/${a.id}`} className="text-primary-600 hover:underline">
      {a.name} <span className="font-mono text-xs text-gray-400" dir="ltr">{a.code}</span>
    </Link>
  );
}

export default function SettlementsPage() {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/finance/settlements?${qs}`);
    if (res.ok) {
      const d = await res.json();
      setRows(d.data);
      setTotalAmount(d.totalAmount);
    }
    setLoading(false);
  }, [type, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="الحركات المالية"
        description="قيود بلا حركة نقدية مع الأطراف: خصم، إعدام دين، تصحيح، تحويل بين حسابين أو صندوقين"
        action={<button onClick={() => setCreating(true)} className="btn-primary text-sm">+ تسوية</button>}
      />
      <SectionTabs tabs={DOCUMENT_TABS} />

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="label text-xs">النوع</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input text-sm">
              <option value="">الكل</option>
              {Object.entries(TYPE_AR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">من تاريخ</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input text-sm" dir="ltr" />
          </div>
          <div>
            <label className="label text-xs">إلى تاريخ</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input text-sm" dir="ltr" />
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-600">إجمالي التسويات</p>
            <p className="font-bold text-gray-800" dir="ltr">{money(totalAmount)}</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <p className="text-gray-400 p-8 text-center text-sm">لا توجد تسويات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="meta">الرقم</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="meta">التاريخ</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="meta">النوع</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="title">البيان</th>
                  <th className="px-4 py-2.5 text-start font-medium">من حساب</th>
                  <th className="px-4 py-2.5 text-start font-medium">إلى حساب</th>
                  <th className="px-4 py-2.5 text-start font-medium" data-card="amount">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs" dir="ltr">{s.voucherNumber}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(s.date)}</td>
                    <td className="px-4 py-2.5"><Badge variant="gray">{TYPE_AR[s.type] ?? s.type}</Badge></td>
                    <td className="px-4 py-2.5">{s.description}</td>
                    {/* The amount leaves the credited account and enters the debited one */}
                    <td className="px-4 py-2.5"><AccountLink a={s.creditAccount} /></td>
                    <td className="px-4 py-2.5"><AccountLink a={s.debitAccount} /></td>
                    <td className="px-4 py-2.5 font-semibold" dir="ltr">{money(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VoucherModal open={creating} kind="settlement" onClose={() => setCreating(false)}
        onDone={(doc) => { load(); if (doc.voucherNumber) alert(`تم ترحيل التسوية رقم ${doc.voucherNumber}`); }} />
    </div>
  );
}
