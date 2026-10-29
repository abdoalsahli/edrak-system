"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, addWeeks, endOfWeek, format, isSameDay, parseISO, startOfWeek, subDays } from "date-fns";
import { arSA } from "date-fns/locale";
import { readApiError } from "@/lib/apiError";
import { PageHeader } from "@/components/ui/PageHeader";
import { TasksBanner } from "@/components/casePlans/TasksBanner";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { AlertTriangle } from "lucide-react";
import { to12, range12 } from "@/lib/time12";

type Apt = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  session: {
    id: string;
    status: string;
    isCharged: boolean;
    outcomeNotes: string | null;
    programSequenceNumber: number | null;
    patient: { fullName: string; patientType: "ADULT" | "CHILD" };
    service: { name: string };
    program: { plannedSessions: number } | null;
  };
};

const STATUS: Record<string, { label: string; variant: "default" | "success" | "danger" | "warning" | "gray" }> = {
  PENDING: { label: "مجدولة", variant: "default" },
  COMPLETED: { label: "مكتملة", variant: "success" },
  ABSENT: { label: "غياب", variant: "danger" },
  CANCELLED_BY_PATIENT: { label: "ألغى المريض", variant: "gray" },
  CANCELLED_BY_CENTER: { label: "ألغى المركز", variant: "gray" },
};
const NOT_HELD: Record<string, string> = { ABSENT: "غياب", CANCELLED_BY_PATIENT: "إلغاء من المريض", CANCELLED_BY_CENTER: "إلغاء من المركز" };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** جدولي — the therapist's own sessions, week by week, with outcome recording. */
export default function MySchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [apts, setApts] = useState<Apt[]>([]);
  const [overdue, setOverdue] = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // outcome modal
  const [target, setTarget] = useState<Apt | null>(null);
  const [outcome, setOutcome] = useState("COMPLETED");
  const [notes, setNotes] = useState("");
  const [askCharge, setAskCharge] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const today = new Date();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const [week, past] = await Promise.all([
      fetch(`/api/my/appointments?from=${iso(weekStart)}&to=${iso(weekEnd)}`),
      // Sessions from the last 60 days still waiting for an outcome
      fetch(`/api/my/appointments?from=${iso(subDays(today, 60))}&to=${iso(subDays(today, 1))}`),
    ]);
    if (!week.ok) { setError(await readApiError(week, "تعذّر تحميل الجدول")); setLoading(false); return; }
    setApts((await week.json()).data);
    if (past.ok) setOverdue(((await past.json()).data as Apt[]).filter((a) => a.session.status === "PENDING"));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);

  function openOutcome(a: Apt) {
    setTarget(a); setOutcome("COMPLETED"); setNotes(""); setAskCharge(false); setModalError("");
  }

  async function submit(charge?: boolean) {
    if (!target) return;
    setSaving(true); setModalError("");
    const res = await fetch(`/api/sessions/${target.session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: outcome, outcomeNotes: notes || undefined, ...(outcome === "COMPLETED" ? {} : { charge }) }),
    });
    setSaving(false);
    if (!res.ok) { setModalError(await readApiError(res)); return; }
    setTarget(null);
    load();
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const pendingThisWeek = apts.filter((a) => a.session.status === "PENDING").length;

  function Card({ a, showDate = false }: { a: Apt; showDate?: boolean }) {
    const st = STATUS[a.session.status] ?? { label: a.session.status, variant: "gray" as const };
    const s = a.session;
    return (
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-primary-700">{range12(a.startTime, a.endTime)}</span>
            {showDate && <span className="text-xs text-gray-500">{format(parseISO(a.date), "EEEE d MMM", { locale: arSA })}</span>}
            <Badge variant={st.variant}>{st.label}</Badge>
            {s.isCharged && s.status !== "COMPLETED" && <span className="text-xs text-gray-400">(محتسبة)</span>}
          </div>
          <p className="font-medium text-gray-900 mt-1">
            {s.patient.fullName}
            {s.patient.patientType === "CHILD" && <span className="text-xs text-gray-400 ms-1.5">طفل</span>}
          </p>
          <p className="text-xs text-gray-500">
            {s.service.name}
            {s.programSequenceNumber != null && s.program && ` · جلسة ${s.programSequenceNumber} من ${s.program.plannedSessions}`}
          </p>
          {s.outcomeNotes && <p className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 mt-1.5">{s.outcomeNotes}</p>}
        </div>
        {s.status === "PENDING" && (
          <button onClick={() => openOutcome(a)} className="btn-primary text-sm whitespace-nowrap">تسجيل النتيجة</button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="جدولي" description="جلساتك وتسجيل نتيجتها" />
      <TasksBanner mode="therapist" />

      {overdue.length > 0 && (
        <div className="card border-amber-200 mb-5 overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-50 text-sm font-semibold text-amber-900">
            <span className="inline-flex items-center gap-2"><AlertTriangle className="size-4" />جلسات سابقة بانتظار تسجيل النتيجة ({overdue.length})</span>
          </div>
          <div className="divide-y divide-gray-100">
            {overdue.map((a) => <Card key={a.id} a={a} showDate />)}
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))} className="btn-secondary text-sm px-3 py-1.5">هذا الأسبوع</button>
          <button onClick={() => setWeekStart((w) => addWeeks(w, -1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="الأسبوع السابق">›</button>
          <button onClick={() => setWeekStart((w) => addWeeks(w, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600" title="الأسبوع التالي">‹</button>
          <h2 className="text-base font-semibold text-gray-900">
            {format(weekStart, "d MMM", { locale: arSA })} – {format(weekEnd, "d MMM yyyy", { locale: arSA })}
          </h2>
          {loading && <span className="text-xs text-gray-400">جارٍ التحميل...</span>}
        </div>
        <p className="text-sm text-gray-500">
          {apts.length} جلسة هذا الأسبوع{pendingThisWeek > 0 && ` · ${pendingThisWeek} بانتظار النتيجة`}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg mb-4">{error}</p>}

      <div className="space-y-4">
        {days.map((day) => {
          const list = apts.filter((a) => isSameDay(parseISO(a.date), day));
          const isToday = isSameDay(day, today);
          if (!list.length && !isToday) return null;
          return (
            <div key={iso(day)} className={`card overflow-hidden ${isToday ? "border-primary-300" : ""}`}>
              <div className={`px-4 py-2.5 text-sm font-semibold flex items-center justify-between ${isToday ? "bg-primary-50 text-primary-800" : "bg-gray-50 text-gray-700"}`}>
                <span>{format(day, "EEEE d MMMM", { locale: arSA })}{isToday && " — اليوم"}</span>
                <span className="text-xs font-normal text-gray-500">{list.length} جلسة</span>
              </div>
              {list.length ? (
                <div className="divide-y divide-gray-100">{list.map((a) => <Card key={a.id} a={a} />)}</div>
              ) : (
                <p className="px-4 py-3 text-sm text-gray-400">لا توجد جلسات اليوم</p>
              )}
            </div>
          );
        })}
        {!loading && apts.length === 0 && !days.some((d) => isSameDay(d, today)) && (
          <p className="text-center text-sm text-gray-400 py-8">لا توجد جلسات في هذا الأسبوع</p>
        )}
      </div>

      {/* Outcome */}
      <Modal open={target !== null} onClose={() => setTarget(null)} title="تسجيل نتيجة الجلسة">
        {target && (askCharge ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="font-semibold text-amber-900">هل تُحتسب قيمة الجلسة على المريض؟</p>
              <p className="text-sm text-amber-800 mt-1">{NOT_HELD[outcome]} — {target.session.patient.fullName}</p>
            </div>
            {modalError && <p className="text-sm text-red-600">{modalError}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={saving} onClick={() => submit(true)} className="btn-primary">{saving ? "جارٍ الحفظ..." : "نعم، تُحتسب"}</button>
              <button type="button" disabled={saving} onClick={() => submit(false)} className="btn-secondary">لا تُحتسب</button>
              <button type="button" disabled={saving} onClick={() => setAskCharge(false)} className="text-sm text-gray-500 hover:underline">رجوع</button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => { e.preventDefault(); if (outcome === "COMPLETED") submit(); else setAskCharge(true); }}
            className="space-y-4"
          >
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {target.session.patient.fullName} · {target.session.service.name} ·{" "}
              <span>{to12(target.startTime)}</span> · {format(parseISO(target.date), "EEEE d MMM", { locale: arSA })}
            </div>
            <div>
              <label className="label">النتيجة</label>
              <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="input">
                <option value="COMPLETED">مكتملة</option>
                <option value="ABSENT">غياب (بدون إشعار)</option>
                <option value="CANCELLED_BY_PATIENT">ألغى المريض (مع إشعار)</option>
                <option value="CANCELLED_BY_CENTER">ألغى المركز</option>
              </select>
            </div>
            <div>
              <label className="label">ملاحظات الجلسة</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input" placeholder="ما تم في الجلسة، ملاحظات للمتابعة..." />
            </div>
            {modalError && <p className="text-sm text-red-600">{modalError}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : outcome === "COMPLETED" ? "حفظ" : "التالي"}</button>
              <button type="button" onClick={() => setTarget(null)} className="btn-secondary">إلغاء</button>
            </div>
          </form>
        ))}
      </Modal>
    </div>
  );
}
