"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

type Patient = { id: string; fullName: string };

type LineItem = { description: string; qty: number; unitPrice: number; discount: number };

function emptyLine(): LineItem {
  return { description: "", qty: 1, unitPrice: 0, discount: 0 };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prePatient = searchParams.get("patientId") ?? "";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(prePatient);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/patients?take=200").then((r) => r.json()).then((d) => setPatients(d.data ?? d));
  }, []);

  function setLine(i: number, field: keyof LineItem, value: string | number) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function total() {
    return lines.reduce((s, l) => s + l.qty * l.unitPrice - l.discount, 0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, lines, notes }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.message ?? JSON.stringify(d));
      setSaving(false);
      return;
    }
    const data = await res.json();
    router.push(`/billing/${data.id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="فاتورة جديدة" />

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-5">
          <div className="mb-4">
            <label className="label">المريض <span className="text-red-500">*</span></label>
            <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input">
              <option value="">— اختر مريضاً —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">بنود الفاتورة</h2>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  {i === 0 && <label className="label text-xs">الوصف</label>}
                  <input required value={l.description} onChange={(e) => setLine(i, "description", e.target.value)} className="input text-sm" placeholder="وصف البند" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="label text-xs">الكمية</label>}
                  <input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, "qty", parseInt(e.target.value))} className="input text-sm" dir="ltr" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="label text-xs">السعر</label>}
                  <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, "unitPrice", parseFloat(e.target.value))} className="input text-sm" dir="ltr" />
                </div>
                <div className="col-span-2">
                  {i === 0 && <label className="label text-xs">الخصم</label>}
                  <input type="number" min={0} step="0.01" value={l.discount} onChange={(e) => setLine(i, "discount", parseFloat(e.target.value))} className="input text-sm" dir="ltr" />
                </div>
                <div className="col-span-1">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none py-2">×</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLines((prev) => [...prev, emptyLine()])} className="btn-secondary text-sm mt-3">
            + إضافة بند
          </button>

          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between font-semibold">
            <span>الإجمالي</span>
            <span dir="ltr">{total().toFixed(2)} ر.س</span>
          </div>
        </div>

        <div className="card p-5">
          <label className="label">ملاحظات</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "إنشاء الفاتورة"}</button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
