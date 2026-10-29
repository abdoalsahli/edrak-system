"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, DOCUMENT_TABS } from "@/components/ui/SectionTabs";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VoucherModal } from "@/components/finance/VoucherModal";

type Disbursement = {
  id: string;
  voucherNumber: string;
  type: string;
  amount: number;
  paymentDate: string;
  paymentMethod: { id: string; name: string };
  description: string;
  referenceNumber: string | null;
  expenseCategory: string | null;
  cashAccount: { name: string; type: string };
  therapist: { id: string; fullName: string } | null;
  patient: { id: string; fullName: string } | null;
  issuedByUser: { name: string };
};

const TYPE_AR: Record<string, { label: string; variant: "info" | "warning" | "danger" | "gray" | "success" }> = {
  COMMISSION: { label: "عمولة", variant: "info" },
  REFUND: { label: "استرداد", variant: "warning" },
  EXPENSE: { label: "مصروف", variant: "danger" },
  SALARY: { label: "راتب", variant: "success" },
  OTHER: { label: "أخرى", variant: "gray" },
};

const CATEGORY_AR: Record<string, string> = {
  RENT: "إيجار", SALARIES: "رواتب", UTILITIES: "خدمات", SUPPLIES: "مستلزمات",
  MAINTENANCE: "صيانة", MARKETING: "تسويق", GOVERNMENT: "رسوم حكومية", OTHER: "أخرى",
};

const fmt = (n: number) =>
  `${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ل`;

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`;
}

export default function VouchersPage() {
  const [rows, setRows] = useState<Disbursement[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState(""); // payment method id
  // every method, disabled ones included, so older documents stay filterable
  const [methods, setMethods] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/finance/payment-methods?all=1").then(r => (r.ok ? r.json() : null)).then(d => d && setMethods(d.data));
    // opened from «طرق الدفع» with a method preselected
    const preset = new URLSearchParams(window.location.search).get("paymentMethodId");
    if (preset) setMethod(preset);
  }, []);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (type) qs.set("type", type);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (method) qs.set("paymentMethodId", method);
    const res = await fetch(`/api/finance/disbursements?${qs}`);
    if (res.ok) {
      const d = await res.json();
      setRows(d.data);
      setTotalAmount(d.totalAmount);
    }
    setLoading(false);
  }, [type, from, to, method]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="السندات والتسويات"
        description="كل المبالغ الصادرة من صناديق المركز"
        action={<button onClick={() => setCreating(true)} className="btn-primary text-sm">+ سند صرف</button>}
      />
      <SectionTabs tabs={DOCUMENT_TABS} />

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-5 gap-3 items-end">
          <div>
            <label className="label text-xs">النوع</label>
            <select value={type} onChange={e => setType(e.target.value)} className="input text-sm">
              <option value="">الكل</option>
              <option value="COMMISSION">عمولات</option>
              <option value="EXPENSE">مصروفات</option>
              <option value="SALARY">رواتب</option>
              <option value="REFUND">استردادات</option>
              <option value="OTHER">أخرى</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">من تاريخ</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input text-sm" dir="ltr" />
          </div>
          <div>
            <label className="label text-xs">إلى تاريخ</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input text-sm" dir="ltr" />
          </div>
          <div>
            <label className="label text-xs">طريقة الدفع</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="input text-sm">
              <option value="">الكل</option>
              {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="bg-red-50 rounded-lg px-3 py-2">
            <p className="text-xs text-red-700">إجمالي المصروف</p>
            <p className="font-bold text-red-700" dir="ltr">{fmt(totalAmount)}</p>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد سندات صرف" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>رقم السند</Th>
                <Th>التاريخ</Th>
                <Th>النوع</Th>
                <Th>البيان</Th>
                <Th>المستفيد</Th>
                <Th>من صندوق</Th>
                <Th>المبلغ</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map(v => {
                const t = TYPE_AR[v.type] ?? { label: v.type, variant: "gray" as const };
                return (
                  <Tr key={v.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium text-gray-700" dir="ltr">{v.voucherNumber}</span>
                    </Td>
                    <Td className="text-sm">{fmtDate(v.paymentDate)}</Td>
                    <Td>
                      <Badge variant={t.variant}>{t.label}</Badge>
                      {v.expenseCategory && (
                        <span className="text-xs text-gray-400 ms-1">{CATEGORY_AR[v.expenseCategory]}</span>
                      )}
                    </Td>
                    <Td className="text-sm">
                      {v.description}
                      {v.referenceNumber && (
                        <span className="text-xs text-gray-400 ms-2" dir="ltr">{v.referenceNumber}</span>
                      )}
                    </Td>
                    <Td className="text-sm">
                      {v.therapist ? (
                        <Link href={`/therapists/${v.therapist.id}`} className="text-primary-600 hover:underline">
                          {v.therapist.fullName}
                        </Link>
                      ) : v.patient ? (
                        <Link href={`/patients/${v.patient.id}`} className="text-primary-600 hover:underline">
                          {v.patient.fullName}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </Td>
                    <Td className="text-sm text-gray-600">
                      {v.cashAccount.name}
                      <span className="text-xs text-gray-400 ms-1">({v.paymentMethod.name})</span>
                    </Td>
                    <Td>
                      <span className="font-semibold text-red-600" dir="ltr">{fmt(v.amount)}</span>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>
      <VoucherModal open={creating} kind="payment" onClose={() => setCreating(false)}
        onDone={(doc) => { load(); if (doc.voucherNumber) alert(`تم إصدار ${"سند الصرف"} رقم ${doc.voucherNumber}`); }} />
    </div>
  );
}
