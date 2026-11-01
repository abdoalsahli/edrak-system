"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, DOCUMENT_TABS } from "@/components/ui/SectionTabs";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VoucherModal } from "@/components/finance/VoucherModal";
import { Printer, AlertTriangle } from "lucide-react";

type Receipt = {
  id: string;
  voucherNumber: string;
  amount: number;
  paymentDate: string;
  paymentMethod: { id: string; name: string };
  referenceNumber: string | null;
  account: { id: string; code: string; name: string } | null;
  patient: { id: string; fullName: string } | null;
  invoice: { id: string; notes: string | null } | null;
  cashAccount: { id: string; name: string } | null;
  receivedByUser: { name: string };
};

type CashAccount = { id: string; name: string };

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`;
}

const fmt = (n: number) =>
  `${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ل`;

export default function ReceiptsPage() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [totals, setTotals] = useState({ received: 0, refunded: 0, net: 0 });
  const [accounts, setAccounts] = useState<CashAccount[]>([]);

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
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

  useEffect(() => {
    fetch("/api/finance/cash-accounts")
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setAccounts(d.data));
  }, []);

  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ take: "200" });
    if (q) qs.set("q", q);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (cashAccountId) qs.set("cashAccountId", cashAccountId);
    if (method) qs.set("paymentMethodId", method);
    const res = await fetch(`/api/finance/receipts?${qs}`);
    if (res.ok) {
      const d = await res.json();
      setRows(d.data);
      setTotals(d.totals);
    }
    setLoading(false);
  }, [q, from, to, cashAccountId, method]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader
        title="الحركات المالية"
        description="كل المبالغ المستلمة من الحالات"
        action={
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="btn-secondary text-sm"><Printer className="size-4" />طباعة</button>
            <button onClick={() => setCreating(true)} className="btn-primary text-sm">+ سند قبض</button>
          </div>
        }
      />
      <SectionTabs tabs={DOCUMENT_TABS} />

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500">إجمالي المقبوض</p>
          <p className="text-xl font-bold text-green-600 mt-1" dir="ltr">{fmt(totals.received)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">إجمالي المسترد</p>
          <p className="text-xl font-bold text-amber-600 mt-1" dir="ltr">{fmt(totals.refunded)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">الصافي</p>
          <p className="text-xl font-bold text-primary-700 mt-1" dir="ltr">{fmt(totals.net)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="label text-xs">الحالة</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم..." className="input text-sm" />
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
            <label className="label text-xs">الصندوق</label>
            <select value={cashAccountId} onChange={e => setCashAccountId(e.target.value)} className="input text-sm">
              <option value="">الكل</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">طريقة الدفع</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="input text-sm">
              <option value="">الكل</option>
              {methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>
        ) : rows.length === 0 ? (
          <EmptyState title="لا توجد سندات قبض" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th card="meta">رقم السند</Th>
                <Th card="meta">التاريخ</Th>
                <Th card="title">الحساب</Th>
                <Th card="meta">الطريقة</Th>
                <Th>الصندوق</Th>
                <Th>المستلم</Th>
                <Th card="amount">المبلغ</Th>
              </tr>
            </Thead>
            <Tbody>
              {rows.map(r => {
                const isRefund = Number(r.amount) < 0;
                return (
                  <Tr key={r.id}>
                    <Td>
                      <span className="font-mono text-xs font-medium text-gray-700" dir="ltr">{r.voucherNumber}</span>
                      {isRefund && <span className="ms-2"><Badge variant="warning">استرداد</Badge></span>}
                    </Td>
                    <Td className="text-sm whitespace-nowrap">{fmtDate(r.paymentDate)}</Td>
                    <Td>
                      {r.account ? (
                        <Link href={`/finance/accounts/${r.account.id}`} className="text-primary-600 hover:underline text-sm">
                          {r.account.name}
                        </Link>
                      ) : (
                        <span className="text-sm">{r.patient?.fullName ?? "—"}</span>
                      )}
                    </Td>
                    <Td className="text-sm">
                      {r.paymentMethod.name}
                      {r.referenceNumber && (
                        <span className="block text-xs text-gray-400" dir="ltr">{r.referenceNumber}</span>
                      )}
                    </Td>
                    <Td className="text-sm">
                      {r.cashAccount ? (
                        <Link href={`/finance/cash-accounts/${r.cashAccount.id}`} className="text-gray-700 hover:underline">
                          {r.cashAccount.name}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-red-500"><AlertTriangle className="size-3.5" />غير مرتبط</span>
                      )}
                    </Td>
                    <Td className="text-sm text-gray-500">{r.receivedByUser.name}</Td>
                    <Td>
                      <span className={`font-semibold ${isRefund ? "text-amber-600" : "text-green-700"}`} dir="ltr">
                        {fmt(Number(r.amount))}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>
      <VoucherModal open={creating} kind="receipt" onClose={() => setCreating(false)}
        onDone={(doc) => { load(); if (doc.voucherNumber) alert(`تم إصدار ${"سند القبض"} رقم ${doc.voucherNumber}`); }} />
    </div>
  );
}
