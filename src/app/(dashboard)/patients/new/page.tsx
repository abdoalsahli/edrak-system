"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

type GuardianForm = {
  fullName: string;
  relationship: string;
  phone: string;
  nationalId: string;
};

type PatientForm = {
  fullName: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  nationalId: string;
  patientType: "ADULT" | "CHILD";
  guardian: GuardianForm;
};

export default function NewPatientPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PatientForm>({
    fullName: "",
    dob: "",
    gender: "",
    phone: "",
    address: "",
    nationalId: "",
    patientType: "ADULT",
    guardian: { fullName: "", relationship: "", phone: "", nationalId: "" },
  });

  function set(field: keyof Omit<PatientForm, "guardian">, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setGuardian(field: keyof GuardianForm, value: string) {
    setForm((f) => ({ ...f, guardian: { ...f.guardian, [field]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      fullName: form.fullName,
      dob: form.dob || null,
      gender: form.gender || null,
      phone: form.phone || null,
      address: form.address || null,
      nationalId: form.nationalId || null,
      patientType: form.patientType,
      guardian:
        form.patientType === "CHILD" && form.guardian.fullName
          ? {
              fullName: form.guardian.fullName,
              relationship: form.guardian.relationship || null,
              phone: form.guardian.phone || null,
              nationalId: form.guardian.nationalId || null,
            }
          : null,
    };

    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "حدث خطأ");
      return;
    }

    const patient = await res.json();
    router.push(`/patients/${patient.id}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="تسجيل مريض جديد" />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Patient type */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">نوع المريض</h2>
          <div className="flex gap-4">
            {(["ADULT", "CHILD"] as const).map((t) => (
              <label key={t} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="patientType"
                  value={t}
                  checked={form.patientType === t}
                  onChange={() => set("patientType", t)}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium">
                  {t === "ADULT" ? "بالغ" : "طفل"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Personal info */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">البيانات الشخصية</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">
                الاسم الكامل <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                className="input"
                placeholder="الاسم الكامل للمريض"
              />
            </div>
            <div>
              <label className="label">تاريخ الميلاد</label>
              <input
                type="date"
                value={form.dob}
                onChange={(e) => set("dob", e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">الجنس</label>
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="input"
              >
                <option value="">— اختر —</option>
                <option value="male">ذكر</option>
                <option value="female">أنثى</option>
              </select>
            </div>
            <div>
              <label className="label">رقم الهاتف</label>
              <input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                className="input"
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label">رقم الهوية</label>
              <input
                value={form.nationalId}
                onChange={(e) => set("nationalId", e.target.value)}
                className="input"
                dir="ltr"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">العنوان</label>
              <input
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Guardian (children only) */}
        {form.patientType === "CHILD" && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">بيانات ولي الأمر</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">
                  اسم ولي الأمر <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.guardian.fullName}
                  onChange={(e) => setGuardian("fullName", e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">صلة القرابة</label>
                <select
                  value={form.guardian.relationship}
                  onChange={(e) => setGuardian("relationship", e.target.value)}
                  className="input"
                >
                  <option value="">— اختر —</option>
                  <option value="father">أب</option>
                  <option value="mother">أم</option>
                  <option value="sibling">أخ / أخت</option>
                  <option value="other">أخرى</option>
                </select>
              </div>
              <div>
                <label className="label">هاتف ولي الأمر</label>
                <input
                  value={form.guardian.phone}
                  onChange={(e) => setGuardian("phone", e.target.value)}
                  className="input"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="label">رقم هوية ولي الأمر</label>
                <input
                  value={form.guardian.nationalId}
                  onChange={(e) => setGuardian("nationalId", e.target.value)}
                  className="input"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : "تسجيل المريض"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}
