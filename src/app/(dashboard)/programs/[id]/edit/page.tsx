"use client";

import { readApiError } from "@/lib/apiError";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScheduleRhythmFields, DAY_AR, daysMatch, daysMismatchMessage } from "@/components/programs/ScheduleRhythmFields";
import { ScheduleCalendar, ScheduleWarnings, fmtDateAr, type ProposedApt } from "@/components/programs/ScheduleCalendar";

type Apt = { date: string; startTime: string; endTime: string; status: string };
type ProgramData = {
  id: string;
  status: string;
  sessionsPerWeek: number;
  sessionPrice: number | string | null;
  sessionCommission: number | string | null;
  therapistId: string;
  patientId: string;
  patient: { fullName: string };
  service: { name: string; defaultDurationMin: number };
  sessions: {
    id: string;
    status: string;
    isCharged: boolean;
    price: number | string | null;
    programSequenceNumber: number | null;
    appointments: Apt[];
  }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const minutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const money = (n: number) => `${n.toFixed(2)} ر.س`;
const todayIso = () => format(new Date(), "yyyy-MM-dd");

/**
 * تعديل البرنامج — move the remaining sessions to new days / times, or change the
 * value and commission per session. Delivered sessions are never moved.
 */
export default function EditProgramPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [program, setProgram] = useState<ProgramData | null>(null);

  // ── schedule ──
  const [startDate, setStartDate] = useState("");
  const [defaultStartTime, setDefaultStartTime] = useState("09:00");
  const [durationMin, setDurationMin] = useState(60);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(3);
  const [allowedDays, setAllowedDays] = useState<number[]>([]);
  const [proposed, setProposed] = useState<ProposedApt[] | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  // ── value ──
  const [price, setPrice] = useState<number | "">("");
  const [commission, setCommission] = useState<number | "">("");
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [savingPrice, setSavingPrice] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${id}`);
    if (!res.ok) return;
    const d: ProgramData = await res.json();
    setProgram(d);

    // Defaults continue the remaining sessions as they are booked today
    const upcoming = d.sessions
      .filter((s) => s.status === "PENDING")
      .map((s) => s.appointments.find((a) => a.status === "SCHEDULED"))
      .filter((a): a is Apt => !!a)
      .sort((a, b) => a.date.localeCompare(b.date));
    const first = upcoming[0];
    const firstDate = first?.date.slice(0, 10);
    setStartDate(firstDate && firstDate > todayIso() ? firstDate : todayIso());
    if (first) {
      setDefaultStartTime(first.startTime);
      setDurationMin(minutes(first.endTime) - minutes(first.startTime) || d.service.defaultDurationMin);
    } else {
      setDurationMin(d.service.defaultDurationMin);
    }
    setSessionsPerWeek(d.sessionsPerWeek);
    const days = [...new Set(upcoming.slice(0, d.sessionsPerWeek).map((a) => new Date(a.date).getDay()))].sort();
    setAllowedDays(days.length === d.sessionsPerWeek ? days : []);

    setPrice(d.sessionPrice != null ? Number(d.sessionPrice) : "");
    setCommission(d.sessionCommission != null ? Number(d.sessionCommission) : "");
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!program) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const editable = program.status === "ACTIVE" || program.status === "EXTENDED";
  const pending = program.sessions
    .filter((s) => s.status === "PENDING")
    .sort((a, b) => (a.programSequenceNumber ?? 0) - (b.programSequenceNumber ?? 0));
  const overdue = pending.filter((s) => {
    const a = s.appointments.find((x) => x.status === "SCHEDULED");
    return a && a.date.slice(0, 10) < todayIso();
  }).length;
  const firstSequence = pending[0]?.programSequenceNumber ?? 1;
  const daysOk = daysMatch(allowedDays, sessionsPerWeek);

  // Current rhythm, for reference
  const upcomingApts = pending.map((s) => s.appointments.find((a) => a.status === "SCHEDULED")).filter((a): a is Apt => !!a);
  const currentDays = [...new Set(upcomingApts.map((a) => new Date(a.date).getDay()))].sort().map((d) => DAY_AR[d]).join("، ");
  const currentTimes = [...new Set(upcomingApts.map((a) => a.startTime))].join("، ");

  async function generatePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!program) return;
    if (!daysOk) { setScheduleError(daysMismatchMessage(sessionsPerWeek)); return; }
    setScheduleError(""); setNotice("");
    setLoading(true);
    const res = await fetch("/api/programs/schedule-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: program.patientId,
        therapistId: program.therapistId,
        startDate,
        totalSessions: pending.length,
        sessionsPerWeek,
        durationMin,
        defaultStartTime,
        allowedDays,
        rescheduleProgramId: program.id,
      }),
    });
    setLoading(false);
    if (!res.ok) { setScheduleError(await readApiError(res)); return; }
    const data = await res.json();
    setProposed(data.proposed.map((a: ProposedApt, i: number) => ({ ...a, sequenceNumber: firstSequence + i })));
    setConflicts(data.conflicts ?? []);
  }

  async function saveSchedule() {
    if (!proposed) return;
    setSavingSchedule(true); setScheduleError("");
    const res = await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule", sessionsPerWeek, appointments: proposed.map(({ date, startTime, endTime }) => ({ date, startTime, endTime })) }),
    });
    setSavingSchedule(false);
    if (!res.ok) { setScheduleError(await readApiError(res)); return; }
    setProposed(null);
    setNotice(`✓ نُقلت مواعيد ${pending.length} جلسة متبقية`);
    load();
  }

  async function savePrice(e: React.FormEvent) {
    e.preventDefault();
    if (!program) return;
    const msg = `سيتم تعديل قيمة البرنامج من ${money(currentTotal)} إلى ${money(newTotal)}، وتُرحَّل الفروقات إلى حساب المريض وحساب الأخصائي. متابعة؟`;
    if (Math.abs(newTotal - currentTotal) > 0.005 && !confirm(msg)) return;
    setSavingPrice(true); setPriceError(""); setNotice("");
    const res = await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reprice", sessionPrice: Number(price) || 0, sessionCommission: Number(commission) || 0, includeCompleted }),
    });
    setSavingPrice(false);
    if (!res.ok) { setPriceError(await readApiError(res)); return; }
    const d = await res.json();
    setNotice(`✓ عُدّلت قيمة ${d.updated} جلسة — قيمة البرنامج الآن ${money(Number(d.invoice?.totalAmount ?? newTotal))}`);
    load();
  }

  // Programme value before / after, on the same rule as the invoice (pending + completed + charged)
  const billable = program.sessions.filter((s) => s.status === "PENDING" || s.status === "COMPLETED" || s.isCharged);
  const affected = (s: ProgramData["sessions"][number]) => s.status === "PENDING" || (includeCompleted && s.status === "COMPLETED");
  const currentTotal = r2(billable.reduce((t, s) => t + Number(s.price ?? 0), 0));
  const newTotal = r2(billable.reduce((t, s) => t + (affected(s) ? Number(price) || 0 : Number(s.price ?? 0)), 0));
  const affectedCount = program.sessions.filter(affected).length;
  const completedCount = program.sessions.filter((s) => s.status === "COMPLETED").length;

  const subtitle = `${program.service.name} — ${program.patient.fullName}`;

  if (!editable) {
    return (
      <div className="max-w-xl">
        <PageHeader title="تعديل البرنامج" description={subtitle} />
        <div className="card p-6 text-sm text-gray-600">
          لا يمكن تعديل برنامج منتهٍ أو ملغى. <Link href={`/programs/${id}`} className="text-primary-600 hover:underline">العودة إلى البرنامج</Link>
        </div>
      </div>
    );
  }

  // ── Preview of the new schedule ──
  if (proposed !== null) {
    return (
      <div className="max-w-4xl">
        <PageHeader title="معاينة المواعيد الجديدة" description={subtitle} />
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "جلسات ستُنقل", value: proposed.length, color: "text-primary-700 bg-primary-50" },
            { label: "من", value: proposed[0] ? fmtDateAr(proposed[0].date).split("،")[1].trim() : "—", color: "text-gray-700 bg-gray-50" },
            { label: "إلى", value: proposed.at(-1) ? fmtDateAr(proposed.at(-1)!.date).split("،")[1].trim() : "—", color: "text-gray-700 bg-gray-50" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
              <p className="text-xs opacity-70">{s.label}</p>
              <p className="font-bold text-lg">{s.value}</p>
            </div>
          ))}
        </div>

        <ScheduleWarnings conflicts={conflicts} generated={proposed.length} requested={pending.length} />
        <ScheduleCalendar proposed={proposed} onChange={setProposed} durationMin={durationMin} firstSequence={firstSequence} allowRemove={false} />

        <p className="text-xs text-gray-400 mt-2">
          تُلغى المواعيد الحالية للجلسات المتبقية وتُنشأ مواعيد جديدة، ويُسجَّل النقل في سجل كل جلسة. الجلسات المكتملة لا تتأثر.
        </p>
        {scheduleError && <p className="text-sm text-red-600 mt-3 bg-red-50 px-4 py-2 rounded-lg">{scheduleError}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={saveSchedule} disabled={savingSchedule || proposed.length !== pending.length} className="btn-primary">
            {savingSchedule ? "جارٍ الحفظ..." : `✓ تأكيد المواعيد الجديدة — ${proposed.length} جلسة`}
          </button>
          <button onClick={() => setProposed(null)} className="btn-secondary">← تعديل الإعدادات</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <PageHeader
        title="تعديل البرنامج"
        description={subtitle}
        action={<Link href={`/programs/${id}`} className="btn-secondary text-sm">العودة إلى البرنامج</Link>}
      />

      {notice && <p className="text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg">{notice}</p>}

      {/* ── Schedule ─────────────────────────────────────────── */}
      <form onSubmit={generatePreview} className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">مواعيد الجلسات المتبقية</h2>
          <p className="text-xs text-gray-500 mt-1">
            {pending.length > 0
              ? <>الحالي: {currentDays || "—"} · الساعة {currentTimes || "—"}</>
              : "لا توجد جلسات متبقية لنقلها"}
          </p>
          {overdue > 0 && (
            <p className="text-xs text-amber-700 mt-1">
              تشمل {overdue} جلسة فات موعدها ولم تُسجَّل نتيجتها — ستُنقل أيضاً. إن كانت قد عُقدت فسجّلها أولاً من صفحة الجلسة.
            </p>
          )}
        </div>

        {pending.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">ابتداءً من <span className="text-red-500">*</span></label>
                <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="label">وقت الجلسة</label>
                <input type="time" value={defaultStartTime} onChange={(e) => setDefaultStartTime(e.target.value)} className="input" dir="ltr" />
              </div>
              <div>
                <label className="label">مدة الجلسة (دقيقة)</label>
                <input type="number" min={15} step={5} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="input" dir="ltr" />
              </div>
            </div>

            <ScheduleRhythmFields
              sessionsPerWeek={sessionsPerWeek} onSessionsPerWeek={setSessionsPerWeek}
              totalSessions={pending.length} onTotalSessions={() => {}}
              allowedDays={allowedDays} onAllowedDays={setAllowedDays}
              totalLabel="الجلسات المتبقية" totalFixed
            />

            {scheduleError && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{scheduleError}</p>}
            <button type="submit" disabled={loading || !daysOk} className="btn-primary">
              {loading ? "جارٍ المعالجة..." : "معاينة المواعيد الجديدة →"}
            </button>
          </>
        )}
      </form>

      {/* ── Value ─────────────────────────────────────────────── */}
      <form onSubmit={savePrice} className="card p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">قيمة الجلسات وعمولة الأخصائي</h2>
          <p className="text-xs text-gray-500 mt-1">
            الحالي: {money(Number(program.sessionPrice ?? 0))} للجلسة · عمولة {money(Number(program.sessionCommission ?? 0))}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">قيمة الجلسة الجديدة (ر.س) <span className="text-red-500">*</span></label>
            <input required type="number" min={0} step="0.01" value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">عمولة الأخصائي من الجلسة (ر.س)</label>
            <input type="number" min={0} step="0.01" value={commission}
              onChange={(e) => setCommission(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input" dir="ltr" />
          </div>
        </div>

        {completedCount > 0 && (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} className="w-4 h-4 accent-primary-600" />
            تطبيق القيمة الجديدة على الجلسات المكتملة أيضاً ({completedCount})
          </label>
        )}

        <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 space-y-1 text-sm text-primary-900">
          <div className="flex justify-between">
            <span>الجلسات المشمولة</span>
            <span className="font-bold">{affectedCount}</span>
          </div>
          <div className="flex justify-between">
            <span>قيمة البرنامج</span>
            <span className="font-bold" dir="ltr">{money(currentTotal)} → {money(newTotal)}</span>
          </div>
          {Math.abs(newTotal - currentTotal) > 0.005 && (
            <p className="text-xs text-primary-700 pt-1">
              يُرحَّل الفرق ({money(Math.abs(newTotal - currentTotal))}) {newTotal > currentTotal ? "على" : "لصالح"} حساب المريض كقيد تعديل واحد، ويُعدَّل حساب الأخصائي بالمثل.
            </p>
          )}
        </div>
        <p className="text-xs text-gray-400">العمولات التي صُرفت بالفعل لا تتغير. تعديل القيمة متاح للمدير فقط.</p>

        {priceError && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{priceError}</p>}
        <button type="submit" disabled={savingPrice || affectedCount === 0} className="btn-primary">
          {savingPrice ? "جارٍ الحفظ..." : "حفظ القيمة الجديدة"}
        </button>
      </form>

      <button onClick={() => router.push(`/programs/${id}`)} className="btn-secondary">رجوع</button>
    </div>
  );
}
