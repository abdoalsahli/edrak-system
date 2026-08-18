"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";

type ProposedApt = { date: string; startTime: string; endTime: string; sequenceNumber: number };

type ProgramSummary = {
  id: string;
  plannedSessions: number;
  sessionsPerWeek: number;
  therapistId: string;
  patientId: string;
  service: { defaultDurationMin: number };
  expectedEndDate: string;
};

export default function ExtendProgramPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [additionalSessions, setAdditionalSessions] = useState(12);
  const [startDate, setStartDate] = useState("");
  const [defaultStartTime, setDefaultStartTime] = useState("09:00");
  const [proposed, setProposed] = useState<ProposedApt[] | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/programs/${id}`)
      .then((r) => r.json())
      .then((d: ProgramSummary) => {
        setProgram(d);
        const afterEnd = new Date(d.expectedEndDate);
        afterEnd.setDate(afterEnd.getDate() + 1);
        setStartDate(format(afterEnd, "yyyy-MM-dd"));
      });
  }, [id]);

  async function generatePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!program) return;
    setError("");
    setLoading(true);
    const res = await fetch("/api/programs/schedule-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: program.patientId,
        therapistId: program.therapistId,
        startDate,
        totalSessions: additionalSessions,
        sessionsPerWeek: program.sessionsPerWeek,
        durationMin: program.service.defaultDurationMin,
        defaultStartTime,
      }),
    });
    const data = await res.json();
    // Offset sequence numbers to continue from existing count
    const offset = program.plannedSessions;
    setProposed(data.proposed.map((a: ProposedApt) => ({ ...a, sequenceNumber: a.sequenceNumber + offset })));
    setConflicts(data.conflicts ?? []);
    setLoading(false);
  }

  async function confirm() {
    if (!proposed) return;
    setSaving(true);
    const res = await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extend", additionalSessions, appointments: proposed }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.message ?? "حدث خطأ");
      setSaving(false);
      return;
    }
    router.push(`/programs/${id}`);
  }

  if (!program) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  if (proposed !== null) {
    return (
      <div className="max-w-3xl">
        <PageHeader title="معاينة التمديد" description={`${proposed.length} موعد إضافي`} />

        {conflicts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="font-medium text-yellow-800 mb-1">تعارضات ({conflicts.length})</p>
            <ul className="text-sm text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
              {conflicts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}

        <div className="card overflow-auto mb-6">
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

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <button onClick={confirm} disabled={saving || proposed.length === 0} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : `تأكيد التمديد (${proposed.length} جلسة)`}
          </button>
          <button onClick={() => setProposed(null)} className="btn-secondary">تعديل</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <PageHeader title="تمديد البرنامج" />

      <form onSubmit={generatePreview} className="card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">جلسات إضافية</label>
            <input type="number" min={1} value={additionalSessions} onChange={(e) => setAdditionalSessions(parseInt(e.target.value))} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">تاريخ بدء التمديد</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت الجلسة الافتراضي</label>
            <input type="time" value={defaultStartTime} onChange={(e) => setDefaultStartTime(e.target.value)} className="input" dir="ltr" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="btn-primary">{loading ? "جارٍ المعالجة..." : "معاينة →"}</button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
