"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { TherapistLoginCard } from "@/components/therapists/TherapistLoginCard";
import { Badge } from "@/components/ui/Badge";
import { Wallet } from "lucide-react";

export default function TherapistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [therapist, setTherapist] = useState<{ fullName: string; specialty?: string | null; phone?: string | null; isActive: boolean; commissionType?: string | null; commissionRate?: number | null; commissionFixed?: number | null } | null>(null);
  const [fullName,        setFullName]        = useState("");
  const [specialty,       setSpecialty]       = useState("");
  const [phone,           setPhone]           = useState("");
  const [commissionType,  setCommissionType]  = useState<"" | "PERCENTAGE" | "FIXED">("");
  const [commissionRate,  setCommissionRate]  = useState("");
  const [commissionFixed, setCommissionFixed] = useState("");
  const [saving,          setSaving]          = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/therapists/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setTherapist(data);
    setFullName(data.fullName);
    setSpecialty(data.specialty ?? "");
    setPhone(data.phone ?? "");
    setCommissionType(data.commissionType ?? "");
    setCommissionRate(data.commissionRate != null ? String(data.commissionRate) : "");
    setCommissionFixed(data.commissionFixed != null ? String(data.commissionFixed) : "");
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/therapists/${id}`, {
      method: "PATCH",
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
    setSaving(false);
    await load();
  }

  async function toggleActive() {
    if (!therapist) return;
    await fetch(`/api/therapists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !therapist.isActive }),
    });
    await load();
  }

  if (!therapist) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={therapist.fullName}
        action={
          <div className="flex gap-2">
            <Link href={`/therapists/${id}/account`} className="btn-primary"><Wallet className="size-4" />حساب الأخصائي</Link>
            <button onClick={toggleActive} className={therapist.isActive ? "btn-secondary" : "btn-primary"}>
              {therapist.isActive ? "إلغاء التفعيل" : "تفعيل"}
            </button>
          </div>
        }
      />

      <TherapistLoginCard therapistId={id} />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">بيانات المعالج</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">الاسم الكامل</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">التخصص</label>
              <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="input" />
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
                <option value="FIXED">مبلغ ثابت (د.ل)</option>
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
                <label className="label">المبلغ الثابت (د.ل)</label>
                <input type="number" min="0" step="0.5" value={commissionFixed}
                  onChange={e => setCommissionFixed(e.target.value)}
                  className="input" dir="ltr" placeholder="مثال: 50" />
                <p className="text-xs text-gray-400 mt-1">مبلغ ثابت لكل جلسة مكتملة</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">رجوع</button>
        </div>
      </form>
    </div>
  );
}
