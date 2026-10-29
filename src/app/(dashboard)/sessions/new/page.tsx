"use client";

import { readApiError } from "@/lib/apiError";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";

type Patient = { id: string; fullName: string };
type Service = { id: string; name: string; deliveryType: string; defaultDurationMin: number };
type Therapist = { id: string; fullName: string };

export default function NewSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prePatientId = searchParams.get("patientId") ?? "";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  const [patientId, setPatientId] = useState(prePatientId);
  const [serviceId, setServiceId] = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [durationMin, setDurationMin] = useState(60);
  const [notes, setNotes] = useState("");
  const [isInsuranceCovered, setIsInsuranceCovered] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/patients?take=200").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/therapists?take=100").then((r) => r.json()),
    ]).then(([p, s, t]) => {
      setPatients(p.data ?? p);
      setServices((s as Service[]).filter((x) => x.deliveryType === "SINGLE_SESSION"));
      setTherapists(t.data ?? t);
    });
  }, []);

  function computeEndTime() {
    if (!startTime) return "";
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + durationMin;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const endTime = computeEndTime();
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, serviceId, therapistId, date, startTime, endTime, notes, isInsuranceCovered }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
      setSaving(false);
      return;
    }
    const data = await res.json();
    router.push(`/sessions/${data.id}`);
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="جلسة فردية جديدة" description="تقييم أو استشارة" />

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <div>
          <label className="label">المريض <span className="text-red-500">*</span></label>
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input">
            <option value="">— اختر مريضاً —</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">الخدمة <span className="text-red-500">*</span></label>
          <select required value={serviceId} onChange={(e) => {
            setServiceId(e.target.value);
            const s = services.find((x) => x.id === e.target.value);
            if (s) setDurationMin(s.defaultDurationMin);
          }} className="input">
            <option value="">— اختر الخدمة —</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">المعالج <span className="text-red-500">*</span></label>
          <select required value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="input">
            <option value="">— اختر المعالج —</option>
            {therapists.map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">التاريخ <span className="text-red-500">*</span></label>
            <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت البدء <span className="text-red-500">*</span></label>
            <input required type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">المدة (دقيقة)</label>
            <input type="number" min={15} step={5} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت الانتهاء</label>
            <input readOnly value={computeEndTime()} className="input bg-gray-50" dir="ltr" />
          </div>
        </div>
        <div>
          <label className="label">ملاحظات</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isInsuranceCovered} onChange={(e) => setIsInsuranceCovered(e.target.checked)} className="accent-primary-600" />
          <span className="text-sm">تغطي التأمين</span>
        </label>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ الجلسة"}</button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
