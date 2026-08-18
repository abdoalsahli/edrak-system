"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

const INV_STATUS: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" | "default" | "info" }> = {
  DRAFT: { label: "مسودة", variant: "gray" },
  ISSUED: { label: "صادرة", variant: "info" },
  PARTIAL: { label: "جزئي", variant: "warning" },
  PAID: { label: "مدفوعة", variant: "success" },
  VOID: { label: "ملغاة", variant: "danger" },
};

type InvoiceData = {
  id: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  issueDate: string;
  dueDate: string;
  notes: string | null;
  patient: { id: string; fullName: string };
  billingCycle: { cycleNumber: number; program: { service: { name: string }; therapist: { fullName: string } } } | null;
  lines: { id: string; description: string; qty: number; unitPrice: number; discount: number; total: number }[];
  payments: { id: string; amount: number; paymentDate: string; method: string; referenceNumber?: string }[];
};

const METHOD_AR: Record<string, string> = {
  CASH: "نقداً",
  CARD: "بطاقة",
  BANK_TRANSFER: "تحويل بنكي",
  INSURANCE: "تأمين",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [payModal, setPayModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [ref, setRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/billing/invoices/${id}`);
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function issue() {
    await fetch(`/api/billing/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ISSUED" }),
    });
    load();
  }

  async function voidInvoice() {
    if (!confirm("هل أنت متأكد من إلغاء هذه الفاتورة؟")) return;
    await fetch(`/api/billing/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VOID" }),
    });
    load();
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/billing/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: id, amount: parseFloat(amount), method, referenceNumber: ref || undefined }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.message ?? "حدث خطأ");
    } else {
      setPayModal(false);
      setAmount("");
      load();
    }
    setSaving(false);
  }

  if (!data) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const st = INV_STATUS[data.status] ?? { label: data.status, variant: "gray" };
  const remaining = Number(data.totalAmount) - Number(data.paidAmount);

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`فاتورة — ${data.patient.fullName}`}
        description={data.billingCycle ? `${data.billingCycle.program.service.name} · دورة ${data.billingCycle.cycleNumber}` : "جلسة فردية"}
        action={
          <div className="flex gap-2">
            {data.status === "DRAFT" && <button onClick={issue} className="btn-primary text-sm">إصدار</button>}
            {(data.status === "ISSUED" || data.status === "PARTIAL") && (
              <button onClick={() => setPayModal(true)} className="btn-primary text-sm">تسجيل دفع</button>
            )}
            {data.status !== "VOID" && data.status !== "PAID" && (
              <button onClick={voidInvoice} className="btn-danger text-sm">إلغاء</button>
            )}
          </div>
        }
      />

      {/* Header card */}
      <div className="card p-5 mb-4 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">الحالة:</span> <Badge variant={st.variant}>{st.label}</Badge></div>
        <div><span className="text-gray-500">المريض:</span> <Link href={`/patients/${data.patient.id}`} className="text-primary-600 hover:underline">{data.patient.fullName}</Link></div>
        <div><span className="text-gray-500">تاريخ الإصدار:</span> {format(new Date(data.issueDate), "d MMM yyyy", { locale: arSA })}</div>
        <div><span className="text-gray-500">تاريخ الاستحقاق:</span> {format(new Date(data.dueDate), "d MMM yyyy", { locale: arSA })}</div>
      </div>

      {/* Lines */}
      <div className="card mb-4">
        <div className="p-4 border-b border-gray-100 font-semibold text-sm">بنود الفاتورة</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-start">الوصف</th>
              <th className="px-4 py-2 text-start">الكمية</th>
              <th className="px-4 py-2 text-start">السعر</th>
              <th className="px-4 py-2 text-start">الخصم</th>
              <th className="px-4 py-2 text-start">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l) => (
              <tr key={l.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2" dir="ltr">{l.qty}</td>
                <td className="px-4 py-2" dir="ltr">{Number(l.unitPrice).toFixed(2)}</td>
                <td className="px-4 py-2" dir="ltr">{Number(l.discount).toFixed(2)}</td>
                <td className="px-4 py-2 font-medium" dir="ltr">{Number(l.total).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td className="px-4 py-2" colSpan={4}>الإجمالي</td>
              <td className="px-4 py-2" dir="ltr">{Number(data.totalAmount).toFixed(2)} ر.س</td>
            </tr>
            <tr>
              <td className="px-4 py-2 text-green-700" colSpan={4}>المدفوع</td>
              <td className="px-4 py-2 text-green-700" dir="ltr">{Number(data.paidAmount).toFixed(2)} ر.س</td>
            </tr>
            {remaining > 0 && (
              <tr>
                <td className="px-4 py-2 text-red-600" colSpan={4}>المتبقي</td>
                <td className="px-4 py-2 text-red-600" dir="ltr">{remaining.toFixed(2)} ر.س</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Payments */}
      {data.payments.length > 0 && (
        <div className="card mb-4">
          <div className="p-4 border-b border-gray-100 font-semibold text-sm">الدفعات</div>
          <div className="divide-y divide-gray-100">
            {data.payments.map((p) => (
              <div key={p.id} className="px-4 py-3 flex justify-between text-sm">
                <div>
                  <span className="font-medium">{METHOD_AR[p.method] ?? p.method}</span>
                  {p.referenceNumber && <span className="text-gray-400 text-xs ms-2">{p.referenceNumber}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500">{format(new Date(p.paymentDate), "d MMM yyyy", { locale: arSA })}</span>
                  <span className="font-medium text-green-700" dir="ltr">{Number(p.amount).toFixed(2)} ر.س</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="تسجيل دفعة">
        <form onSubmit={recordPayment} className="space-y-4">
          <div>
            <label className="label">المبلغ (المتبقي: {remaining.toFixed(2)} ر.س)</label>
            <input required type="number" min="0.01" step="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">طريقة الدفع</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="input">
              <option value="CASH">نقداً</option>
              <option value="CARD">بطاقة</option>
              <option value="BANK_TRANSFER">تحويل بنكي</option>
              <option value="INSURANCE">تأمين</option>
            </select>
          </div>
          <div>
            <label className="label">رقم المرجع (اختياري)</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="input" dir="ltr" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ الدفعة"}</button>
            <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
