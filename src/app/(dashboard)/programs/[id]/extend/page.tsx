"use client";

import { readApiError } from "@/lib/apiError";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScheduleRhythmFields, WEEKS_PER_PROGRAM, daysMatch, daysMismatchMessage } from "@/components/programs/ScheduleRhythmFields";
import { ScheduleCalendar, ScheduleWarnings, fmtDateAr, type ProposedApt } from "@/components/programs/ScheduleCalendar";
import { previousPackage, extensionTotals } from "@/lib/programs/packageTotals";

type ProgramSummary = {
  id: string;
  status: string;
  plannedSessions: number;
  originalPlannedSessions: number;
  sessionsPerWeek: number;
  sessionPrice: number | string | null;
  sessionCommission: number | string | null;
  therapistId: string;
  patientId: string;
  patient: { fullName: string };
  service: { name: string; defaultDurationMin: number };
  expectedEndDate: string;
  sessions: {
    programSequenceNumber: number | null;
    price: number | string | null;
    commissionAmount: number | string | null;
    appointments: { date: string; startTime: string; endTime: string; status: string }[];
  }[];
};

const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export default function ExtendProgramPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [program, setProgram] = useState<ProgramSummary | null>(null);
  const [startDate, setStartDate] = useState("");
  const [defaultStartTime, setDefaultStartTime] = useState("15:00");
  const [durationMin, setDurationMin] = useState(60);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [totalSessions, setTotalSessions] = useState(12);
  const [allowedDays, setAllowedDays] = useState<number[]>([]);

  const [proposed, setProposed] = useState<ProposedApt[] | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Defaults continue the programme as it runs today
  useEffect(() => {
    fetch(`/api/programs/${id}`)
      .then((r) => r.json())
      .then((d: ProgramSummary) => {
        setProgram(d);
        const apts = d.sessions
          .flatMap((s) => s.appointments)
          .filter((a) => a.status !== "CANCELLED")
          .sort((a, b) => a.date.localeCompare(b.date));
        const last = apts.at(-1);

        // Start the day after the last appointment
        const after = new Date(last?.date ?? d.expectedEndDate);
        after.setDate(after.getDate() + 1);
        setStartDate(format(after, "yyyy-MM-dd"));

        if (last) {
          setDefaultStartTime(last.startTime);
          setDurationMin(minutes(last.endTime) - minutes(last.startTime) || d.service.defaultDurationMin);
        } else {
          setDurationMin(d.service.defaultDurationMin);
        }

        const perWeek = d.sessionsPerWeek;
        setSessionsPerWeek(perWeek);
        setTotalSessions(perWeek * WEEKS_PER_PROGRAM);

        // Same weekdays as the most recent sessions, when they match the weekly count
        const recentDays = [...new Set(apts.slice(-perWeek).map((a) => new Date(a.date).getDay()))].sort();
        setAllowedDays(recentDays.length === perWeek ? recentDays : []);
      });
  }, [id]);

  const daysOk = daysMatch(allowedDays, sessionsPerWeek);
  // New sessions continue the programme's numbering
  const firstSequence = program
    ? Math.max(program.plannedSessions, ...program.sessions.map((s) => s.programSequenceNumber ?? 0)) + 1
    : 1;

  async function generatePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!program) return;
    if (!daysOk) { setError(daysMismatchMessage(sessionsPerWeek)); return; }
    setError("");
    setLoading(true);
    const res = await fetch("/api/programs/schedule-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: program.patientId,
        therapistId: program.therapistId,
        startDate,
        totalSessions,
        sessionsPerWeek,
        durationMin,
        defaultStartTime,
        allowedDays,
      }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setProposed(data.proposed.map((a: ProposedApt, i: number) => ({ ...a, sequenceNumber: firstSequence + i })));
    setConflicts(data.conflicts ?? []);
    setLoading(false);
  }

  async function confirm() {
    if (!proposed) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extend", additionalSessions: proposed.length, appointments: proposed }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
      setSaving(false);
      return;
    }
    router.push(`/programs/${id}`);
  }

  if (!program) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const subtitle = `${program.service.name} — ${program.patient.fullName}`;
  // The extension costs what the previous package cost — the same rule as the server
  const prev = previousPackage(program.sessions, program.originalPlannedSessions);
  const money = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل`;
  const basis = (added: number) =>
    added === prev.count
      ? `نفس إجمالي الباقة السابقة (${prev.count} جلسة)`
      : `بالتناسب مع الباقة السابقة: ${money(prev.value)} لـ ${prev.count} جلسة`;

  if (proposed !== null) {
    const added = extensionTotals(prev, proposed.length);

    return (
      <div className="max-w-4xl">
        <PageHeader title="معاينة التمديد" description={subtitle} />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-5">
          {[
            { label: "جلسات إضافية", value: proposed.length, color: "text-primary-700 bg-primary-50" },
            { label: "قيمة التمديد", value: money(added.value), color: "text-blue-700 bg-blue-50" },
            { label: "من", value: proposed[0] ? fmtDateAr(proposed[0].date).split("،")[1].trim() : "—", color: "text-gray-700 bg-gray-50" },
            { label: "إلى", value: proposed.at(-1) ? fmtDateAr(proposed.at(-1)!.date).split("،")[1].trim() : "—", color: "text-gray-700 bg-gray-50" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
              <p className="text-xs opacity-70">{s.label}</p>
              <p className="font-bold text-lg">{s.value}</p>
            </div>
          ))}
        </div>

        <ScheduleWarnings conflicts={conflicts} generated={proposed.length} requested={totalSessions} />

        <ScheduleCalendar proposed={proposed} onChange={setProposed} durationMin={durationMin} firstSequence={firstSequence} />

        <div className="card p-4 mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">قيمة التمديد على الحالة</p>
            <p className="font-bold text-gray-800 mt-0.5">{money(added.value)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">عمولة الأخصائي عن التمديد</p>
            <p className="font-bold text-amber-700 mt-0.5">{money(added.commission)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">أساس الحساب</p>
            <p className="font-medium text-gray-700 mt-0.5 text-xs leading-5">{basis(proposed.length)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          تُضاف قيمة التمديد إلى فاتورة البرنامج وحساب الحالة، وعمولته إلى حساب الأخصائي، كقيد تعديل واحد لكل منهما.
        </p>

        {error && <p className="text-sm text-red-600 mt-3 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={confirm} disabled={saving || proposed.length === 0} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : `✓ تأكيد التمديد — ${proposed.length} جلسة`}
          </button>
          <button onClick={() => setProposed(null)} className="btn-secondary">← تعديل الإعدادات</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="تمديد البرنامج" description={subtitle} />

      <form onSubmit={generatePreview} className="card p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="label">تاريخ بدء التمديد <span className="text-red-500">*</span></label>
            <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت الجلسة الافتراضي</label>
            <input type="time" value={defaultStartTime} onChange={(e) => setDefaultStartTime(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">مدة الجلسة (دقيقة)</label>
            <input type="number" min={15} step={5} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="input" dir="ltr" />
          </div>
        </div>

        <ScheduleRhythmFields
          sessionsPerWeek={sessionsPerWeek} onSessionsPerWeek={setSessionsPerWeek}
          totalSessions={totalSessions} onTotalSessions={setTotalSessions}
          allowedDays={allowedDays} onAllowedDays={setAllowedDays}
          totalLabel="الجلسات الإضافية"
        />

        {prev.value > 0 && totalSessions > 0 && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-sm text-primary-900 space-y-1">
            <div className="flex items-center justify-between">
              <span>قيمة التمديد</span>
              <span className="font-bold">{money(extensionTotals(prev, totalSessions).value)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-primary-800/80">
              <span>عمولة الأخصائي</span>
              <span className="font-semibold">{money(extensionTotals(prev, totalSessions).commission)}</span>
            </div>
            <p className="text-xs text-primary-800/70">{basis(totalSessions)}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || !daysOk} className="btn-primary">
            {loading ? "جارٍ المعالجة..." : "معاينة الجدول →"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
