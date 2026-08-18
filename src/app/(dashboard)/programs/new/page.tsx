"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";

type Patient = { id: string; fullName: string };
type Service = { id: string; name: string; deliveryType: string; defaultDurationMin: number; defaultSessionsPerWeek?: number | null; defaultTotalSessions?: number | null };
type Therapist = { id: string; fullName: string };
type ProposedApt = { date: string; startTime: string; endTime: string; sequenceNumber: number };

type Step = "config" | "preview" | "confirm";

export default function NewProgramPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prePatientId = searchParams.get("patientId") ?? "";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  const [patientId, setPatientId] = useState(prePatientId);
  const [serviceId, setServiceId] = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [totalSessions, setTotalSessions] = useState(12);
  const [durationMin, setDurationMin] = useState(60);
  const [defaultStartTime, setDefaultStartTime] = useState("09:00");
  const [notes, setNotes] = useState("");

  const [step, setStep] = useState<Step>("config");
  const [proposed, setProposed] = useState<ProposedApt[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/patients?take=200").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
      fetch("/api/therapists?take=100").then((r) => r.json()),
    ]).then(([p, s, t]) => {
      setPatients(p.data ?? p);
      setServices((s as Service[]).filter((x) => x.deliveryType === "PROGRAM"));
      setTherapists(t.data ?? t);
    });
  }, []);

  function onServiceChange(id: string) {
    setServiceId(id);
    const s = services.find((x) => x.id === id);
    if (s) {
      setDurationMin(s.defaultDurationMin);
      if (s.defaultSessionsPerWeek) setSessionsPerWeek(s.defaultSessionsPerWeek);
      if (s.defaultTotalSessions) setTotalSessions(s.defaultTotalSessions);
    }
  }

  async function generatePreview(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/programs/schedule-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, therapistId, startDate, totalSessions, sessionsPerWeek, durationMin, defaultStartTime }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.message ?? JSON.stringify(d));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setProposed(data.proposed);
    setConflicts(data.conflicts ?? []);
    setStep("preview");
    setLoading(false);
  }

  async function confirmAndSave() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId, serviceId, therapistId, startDate, sessionsPerWeek, totalSessions, durationMin, defaultStartTime, notes,
        appointments: proposed,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.message ?? JSON.stringify(d));
      setSaving(false);
      return;
    }
    const data = await res.json();
    router.push(`/programs/${data.id}`);
  }

  if (step === "preview") {
    return (
      <div className="max-w-3xl">
        <PageHeader title="معاينة الجدول" description={`${proposed.length} موعد مقترح`} />

        {conflicts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="font-medium text-yellow-800 mb-2">تعارضات تم تجاوزها ({conflicts.length})</p>
            <ul className="text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
              {conflicts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        {proposed.length < totalSessions && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-700">
            تحذير: تم توليد {proposed.length} موعد من أصل {totalSessions} مطلوب. قد تحتاج لتعديل إعدادات الجدولة.
          </div>
        )}

        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-gray-500 font-medium">#</th>
                <th className="px-4 py-2 text-start text-gray-500 font-medium">التاريخ</th>
                <th className="px-4 py-2 text-start text-gray-500 font-medium">الوقت</th>
              </tr>
            </thead>
            <tbody>
              {proposed.map((a) => (
                <tr key={a.sequenceNumber} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-gray-500">{a.sequenceNumber}</td>
                  <td className="px-4 py-2">{format(new Date(a.date), "EEEE d MMM yyyy", { locale: arSA })}</td>
                  <td className="px-4 py-2" dir="ltr">{a.startTime} – {a.endTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button onClick={confirmAndSave} disabled={saving || proposed.length === 0} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : `تأكيد وإنشاء البرنامج (${proposed.length} جلسة)`}
          </button>
          <button onClick={() => setStep("config")} className="btn-secondary">تعديل الإعدادات</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="برنامج علاجي جديد" />

      <form onSubmit={generatePreview} className="card p-6 space-y-4">
        <div>
          <label className="label">المريض <span className="text-red-500">*</span></label>
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="input">
            <option value="">— اختر مريضاً —</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">الخدمة <span className="text-red-500">*</span></label>
          <select required value={serviceId} onChange={(e) => onServiceChange(e.target.value)} className="input">
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
            <label className="label">تاريخ البدء <span className="text-red-500">*</span></label>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت الجلسة الافتراضي</label>
            <input type="time" value={defaultStartTime} onChange={(e) => setDefaultStartTime(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">جلسات في الأسبوع</label>
            <input type="number" min={1} max={7} value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(parseInt(e.target.value))} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">إجمالي الجلسات</label>
            <input type="number" min={1} value={totalSessions} onChange={(e) => setTotalSessions(parseInt(e.target.value))} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">مدة الجلسة (دقيقة)</label>
            <input type="number" min={15} step={5} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="input" dir="ltr" />
          </div>
        </div>

        <div>
          <label className="label">ملاحظات</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "جارٍ المعالجة..." : "معاينة الجدول →"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
