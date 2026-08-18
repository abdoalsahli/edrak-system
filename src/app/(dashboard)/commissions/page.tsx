"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import Link from "next/link";

type Commission = {
  id: string;
  commissionType: "PERCENTAGE" | "FIXED";
  rate: number | null;
  baseAmount: number | null;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  createdAt: string;
  notes: string | null;
  therapist: { id: string; fullName: string };
  session: {
    id: string;
    patient: { fullName: string };
    service: { name: string };
  };
  paidByUser: { name: string } | null;
};

type Summary = { commissions: Commission[]; totalUnpaid: number; totalPaid: number };

export default function CommissionsPage() {
  const [data,          setData]          = useState<Summary | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [filterPaid,    setFilterPaid]    = useState<"" | "false" | "true">("");
  const [filterFrom,    setFilterFrom]    = useState("");
  const [filterTo,      setFilterTo]      = useState("");
  const [payModal,      setPayModal]      = useState<Commission | null>(null);
  const [payNotes,      setPayNotes]      = useState("");
  const [paying,        setPaying]        = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterPaid) params.set("isPaid", filterPaid);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo)   params.set("to",   filterTo);
    const res = await fetch(`/api/commissions?${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterPaid, filterFrom, filterTo]);

  useEffect(() => { load(); }, [load]);

  async function handlePay() {
    if (!payModal) return;
    setPaying(true);
    await fetch(`/api/commissions/${payModal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", notes: payNotes }),
    });
    setPaying(false);
    setPayModal(null);
    setPayNotes("");
    load();
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

  return (
    <div className="space-y-6">
      <PageHeader
        title="عمولات المعالجين"
        description="تتبع العمولات المستحقة لكل معالج وتسجيل المدفوعات"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">إجمالي مستحق</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {data ? fmt(data.totalUnpaid) : "—"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">إجمالي مدفوع</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {data ? fmt(data.totalPaid) : "—"}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">عدد السجلات</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {data ? data.commissions.length : "—"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">الحالة</label>
          <select value={filterPaid} onChange={e => setFilterPaid(e.target.value as "" | "false" | "true")} className="input w-36">
            <option value="">الكل</option>
            <option value="false">مستحقة</option>
            <option value="true">مدفوعة</option>
          </select>
        </div>
        <div>
          <label className="label">من تاريخ</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="input" dir="ltr" />
        </div>
        <div>
          <label className="label">إلى تاريخ</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="input" dir="ltr" />
        </div>
        <button onClick={load} className="btn-primary">تصفية</button>
        <button onClick={() => { setFilterPaid(""); setFilterFrom(""); setFilterTo(""); }} className="btn-secondary">إعادة تعيين</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-600">المعالج</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">المريض</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الخدمة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">النسبة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الأساس</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">العمولة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">التاريخ</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">جارٍ التحميل...</td></tr>
              )}
              {!loading && data?.commissions.length === 0 && (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">لا توجد عمولات</td></tr>
              )}
              {data?.commissions.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.therapist.fullName}</td>
                  <td className="px-4 py-3">
                    <Link href={`/sessions/${c.session.id}`} className="text-primary-600 hover:underline">
                      {c.session.patient.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.session.service.name}</td>
                  <td className="px-4 py-3 text-xs" dir="ltr">
                    {c.commissionType === "PERCENTAGE"
                      ? `${Number(c.rate).toFixed(1)}%`
                      : "ثابت"}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {c.commissionType === "PERCENTAGE" && c.baseAmount
                      ? fmt(Number(c.baseAmount))
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-primary-700" dir="ltr">{fmt(Number(c.amount))}</td>
                  <td className="px-4 py-3 text-gray-500" dir="ltr">
                    {format(parseISO(c.createdAt), "d MMM yyyy", { locale: arSA })}
                  </td>
                  <td className="px-4 py-3">
                    {c.isPaid ? (
                      <span className="badge-green">مدفوعة</span>
                    ) : (
                      <span className="badge-yellow">مستحقة</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!c.isPaid && (
                      <button
                        onClick={() => { setPayModal(c); setPayNotes(""); }}
                        className="text-xs text-primary-600 hover:underline"
                      >
                        تسجيل دفع
                      </button>
                    )}
                    {c.isPaid && c.paidAt && (
                      <span className="text-xs text-gray-400">
                        {format(parseISO(c.paidAt), "d/M/yyyy", { locale: arSA })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title="تسجيل دفع عمولة">
        {payModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
              <p><span className="text-gray-500">المعالج:</span> <strong>{payModal.therapist.fullName}</strong></p>
              <p><span className="text-gray-500">المريض:</span> {payModal.session.patient.fullName}</p>
              <p><span className="text-gray-500">مبلغ العمولة:</span> <strong className="text-primary-700">{fmt(Number(payModal.amount))}</strong></p>
            </div>
            <div>
              <label className="label">ملاحظات (اختياري)</label>
              <textarea value={payNotes} onChange={e => setPayNotes(e.target.value)} rows={2} className="input" />
            </div>
            <div className="flex gap-3">
              <button onClick={handlePay} disabled={paying} className="btn-primary">
                {paying ? "جارٍ الحفظ..." : "تأكيد الدفع"}
              </button>
              <button onClick={() => setPayModal(null)} className="btn-secondary">إلغاء</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
