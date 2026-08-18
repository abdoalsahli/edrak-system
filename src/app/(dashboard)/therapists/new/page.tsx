"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

const DAYS = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
];

type AvailabilityRow = { dayOfWeek: number; startTime: string; endTime: string; enabled: boolean };

export default function NewTherapistPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullName,       setFullName]       = useState("");
  const [specialty,      setSpecialty]      = useState("");
  const [phone,          setPhone]          = useState("");
  const [commissionType,  setCommissionType]  = useState<"" | "PERCENTAGE" | "FIXED">("");
  const [commissionRate,  setCommissionRate]  = useState("");
  const [commissionFixed, setCommissionFixed] = useState("");
  const [availability, setAvailability] = useState<AvailabilityRow[]>(
    DAYS.map((d) => ({ dayOfWeek: d.value, startTime: "08:00", endTime: "17:00", enabled: d.value < 5 }))
  );

  function toggleDay(idx: number) {
    setAvailability((prev) => prev.map((r, i) => (i === idx ? { ...r, enabled: !r.enabled } : r)));
  }

  function setTime(idx: number, field: "startTime" | "endTime", value: string) {
    setAvailability((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const res = await fetch("/api/therapists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        specialty: specialty || null,
        phone: phone || null,
        commissionType:  commissionType  || null,
        commissionRate:  commissionType === "PERCENTAGE" && commissionRate  ? parseFloat(commissionRate)  : null,
        commissionFixed: commissionType === "FIXED"      && commissionFixed ? parseFloat(commissionFixed) : null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "حدث خطأ");
      setSaving(false);
      return;
    }

    const therapist = await res.json();

    const enabledDays = availability.filter((a) => a.enabled);
    if (enabledDays.length > 0) {
      await fetch(`/api/therapists/${therapist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability: enabledDays.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })) }),
      });
    }

    setSaving(false);
    router.push(`/therapists/${therapist.id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="إضافة معالج جديد" />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">بيانات المعالج</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">الاسم الكامل <span className="text-red-500">*</span></label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">التخصص</label>
              <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="input" placeholder="مثال: معالج نطق" />
            </div>
            <div>
              <label className="label">الهاتف</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">نوع العمولة</label>
              <select value={commissionType} onChange={e => setCommissionType(e.target.value as "" | "PERCENTAGE" | "FIXED")} className="input">
                <option value="">— بدون عمولة —</option>
                <option value="PERCENTAGE">نسبة مئوية (%)</option>
                <option value="FIXED">مبلغ ثابت (ر.س)</option>
              </select>
            </div>
            {commissionType === "PERCENTAGE" && (
              <div>
                <label className="label">النسبة المئوية</label>
                <input type="number" min="0" max="100" step="0.5" value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value)}
                  className="input" dir="ltr" placeholder="مثال: 30" />
                <p className="text-xs text-gray-400 mt-1">% من إجمالي الفاتورة لكل جلسة</p>
              </div>
            )}
            {commissionType === "FIXED" && (
              <div>
                <label className="label">المبلغ الثابت (ر.س)</label>
                <input type="number" min="0" step="0.5" value={commissionFixed}
                  onChange={e => setCommissionFixed(e.target.value)}
                  className="input" dir="ltr" placeholder="مثال: 50" />
                <p className="text-xs text-gray-400 mt-1">مبلغ ثابت لكل جلسة مكتملة</p>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">أوقات العمل الأسبوعية</h2>
          <div className="space-y-3">
            {DAYS.map((day, idx) => (
              <div key={day.value} className="flex items-center gap-4">
                <label className="flex items-center gap-2 w-24 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={availability[idx].enabled}
                    onChange={() => toggleDay(idx)}
                    className="accent-primary-600"
                  />
                  <span className="text-sm font-medium">{day.label}</span>
                </label>
                {availability[idx].enabled && (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={availability[idx].startTime}
                      onChange={(e) => setTime(idx, "startTime", e.target.value)}
                      className="input py-1 px-2 w-28"
                    />
                    <span className="text-gray-400">—</span>
                    <input
                      type="time"
                      value={availability[idx].endTime}
                      onChange={(e) => setTime(idx, "endTime", e.target.value)}
                      className="input py-1 px-2 w-28"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "إضافة المعالج"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
