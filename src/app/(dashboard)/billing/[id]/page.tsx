"use client";

import { readApiError } from "@/lib/apiError";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

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
  issueDate: string | null;
  dueDate: string | null;
  programId: string | null;
  sessionId: string | null;
  standaloneSession: { id: string; status: string } | null;
  notes: string | null;
  patient: { id: string; fullName: string };
  billingCycle: { cycleNumber: number; program: { service: { name: string }; therapist: { fullName: string } } } | null;
  lines: { id: string; description: string; qty: number; unitPrice: number; discount: number; total: number }[];
  payments: { id: string; voucherNumber: string; amount: number; paymentDate: string; paymentMethod: { name: string }; referenceNumber?: string }[];
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<InvoiceData | null>(null);
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

  async function recalc() {
    const res = await fetch(`/api/billing/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recalc" }),
    });
    if (!res.ok) {
      alert(await readApiError(res, "تعذّرت إعادة الحساب"));
    }
    load();
  }

  if (!data) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const st = INV_STATUS[data.status] ?? { label: data.status, variant: "gray" };
  const remaining = Number(data.totalAmount) - Number(data.paidAmount);
  const credit = remaining < 0 ? Math.abs(remaining) : 0;   // patient overpaid → refund owed
  // A completed standalone session has been earned — no refund
  const sessionCompleted = data.standaloneSession?.status === "COMPLETED";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`فاتورة — ${data.patient.fullName}`}
        description={data.programId ? "فاتورة برنامج" : data.sessionId ? "فاتورة جلسة فردية" : "فاتورة يدوية"}
        action={
          <div className="flex gap-2">
            {data.status === "DRAFT" && <button onClick={issue} className="btn-primary text-sm">إصدار</button>}
            {/* Receipts and refunds are posted to the patient's current account, not to an invoice */}
            <Link href={`/finance/accounts/patient:${data.patient.id}`} className="btn-primary text-sm">حساب الحالة</Link>
            {data.programId && data.status !== "VOID" && (
              <button onClick={recalc} className="btn-secondary text-sm" title="إعادة حساب الإجمالي من البرنامج">
                ↻ إعادة حساب
              </button>
            )}
            {data.status !== "VOID" && data.status !== "PAID" && Number(data.paidAmount) === 0 && (
              <button onClick={voidInvoice} className="btn-danger text-sm">إلغاء</button>
            )}
          </div>
        }
      />

      {/* Header card */}
      <div className="card p-5 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">الحالة:</span> <Badge variant={st.variant}>{st.label}</Badge></div>
        <div><span className="text-gray-500">الحالة:</span> <Link href={`/patients/${data.patient.id}`} className="text-primary-600 hover:underline">{data.patient.fullName}</Link></div>
        <div><span className="text-gray-500">تاريخ الإصدار:</span> {data.issueDate ? format(new Date(data.issueDate), "d MMM yyyy", { locale: arSA }) : "—"}</div>
        <div><span className="text-gray-500">تاريخ الاستحقاق:</span> {data.dueDate ? format(new Date(data.dueDate), "d MMM yyyy", { locale: arSA }) : "—"}</div>
      </div>

      {/* Delivered sessions lines */}
      {data.lines.length > 0 && (
        <div className="card mb-4">
          <div className="p-4 border-b border-gray-100 font-semibold text-sm">الجلسات المنجزة</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 text-start">الوصف</th>
                <th className="px-4 py-2 text-start">السعر</th>
                <th className="px-4 py-2 text-start">الخصم</th>
                <th className="px-4 py-2 text-start">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.map((l) => (
                <tr key={l.id} className="border-t border-gray-100">
                  <td className="px-4 py-2">{l.description}</td>
                  <td className="px-4 py-2" dir="ltr">{Number(l.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-2" dir="ltr">{Number(l.discount).toFixed(2)}</td>
                  <td className="px-4 py-2 font-medium" dir="ltr">{Number(l.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Financial summary */}
      <div className="card mb-4 divide-y divide-gray-100 text-sm">
        <div className="px-5 py-3 flex justify-between">
          <span className="text-gray-500">{data.programId ? "إجمالي الفاتورة (قيمة البرنامج)" : "إجمالي الفاتورة"}</span>
          <span className="font-semibold" dir="ltr">{Number(data.totalAmount).toFixed(2)} د.ل</span>
        </div>
        {data.lines.length > 0 && (
          <div className="px-5 py-3 flex justify-between text-blue-700">
            <span>قيمة الجلسات المنجزة حتى الآن</span>
            <span className="font-semibold" dir="ltr">
              {data.lines.reduce((s, l) => s + Number(l.total), 0).toFixed(2)} د.ل
            </span>
          </div>
        )}
        <div className="px-5 py-3 text-xs text-gray-500 bg-gray-50">
          تُقيَّد هذه الفاتورة مديناً على حساب الحالة، والتحصيل يُسجَّل بسندات قبض على الحساب نفسه.{" "}
          <Link href={`/finance/accounts/patient:${data.patient.id}`} className="text-primary-600 hover:underline">
            عرض رصيد الحالة ←
          </Link>
        </div>
      </div>

      {/* Payments */}
      {data.payments.length > 0 && (
        <div className="card mb-4">
          <div className="p-4 border-b border-gray-100 font-semibold text-sm">الدفعات</div>
          <div className="divide-y divide-gray-100">
            {data.payments.map((p) => {
              const isRefund = Number(p.amount) < 0;
              return (
                <div key={p.id} className="px-4 py-3 flex justify-between text-sm">
                  <div>
                    <span className="font-mono text-xs text-gray-600 me-2" dir="ltr">{p.voucherNumber}</span>
                    <span className="font-medium">{p.paymentMethod.name}</span>
                    {isRefund && <span className="badge-cancelled ms-2">استرداد</span>}
                    {p.referenceNumber && <span className="text-gray-400 text-xs ms-2">{p.referenceNumber}</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">{format(new Date(p.paymentDate), "d MMM yyyy", { locale: arSA })}</span>
                    <span className={`font-medium ${isRefund ? "text-red-600" : "text-green-700"}`} dir="ltr">
                      {Number(p.amount).toFixed(2)} د.ل
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
