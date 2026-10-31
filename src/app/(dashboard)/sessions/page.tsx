"use client";

import { readApiError } from "@/lib/apiError";
import { PaymentMethodField } from "@/components/finance/PaymentMethodField";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  format, addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isSameDay, isSameMonth, parseISO,
} from "date-fns";
import { arSA } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { DEFAULT_SESSION_MINUTES, DEFAULT_SESSION_PRICE, sessionDefaults } from "@/lib/sessionDefaults";
import { to12, range12, hour12 } from "@/lib/time12";
import { WEEK_STARTS_ON, WEEK_ORDER } from "@/lib/week";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_START   = 7;  // 7 am
const DAY_END     = 22; // 10 pm
/** The calendar opens on this hour, and new bookings default to it (3 pm). */
const DEFAULT_HOUR = 15;
const DEFAULT_TIME = "15:00";
const HOURS       = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START);

const DAY_NAMES_SHORT = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-primary-100 border-primary-600 text-gray-800",
  DELIVERED: "bg-green-100 border-green-500 text-gray-800",
};

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-primary-600",
  DELIVERED: "bg-green-500",
};

type View = "day" | "week" | "month";

// ─── Types ───────────────────────────────────────────────────────────────────

type Appointment = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  isMakeup: boolean;
  session: {
    id: string;
    patient: { id: string; fullName: string; patientType: "ADULT" | "CHILD" };
    service: { name: string };
    program: { id: string } | null;
  };
  therapist: { id: string; fullName: string };
  room: { name: string } | null;
};

type Patient   = { id: string; fullName: string };
type Service   = { id: string; name: string; defaultDurationMin: number; defaultPrice?: number | null };
type Therapist = { id: string; fullName: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function addMins(t: string, mins: number) {
  const total = timeToMinutes(t) + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AptCard({ apt }: { apt: Appointment; compact?: boolean; narrow?: boolean }) {
  const color = STATUS_COLOR[apt.status] ?? "bg-gray-100 border-gray-400 text-gray-800";
  return (
    <Link
      href={`/sessions/${apt.session.id}`}
      className={`flex h-full items-center overflow-hidden rounded-lg border-e-[3px] px-1.5 ${color} transition hover:opacity-85`}
      title={`${apt.session.patient.fullName}\n${range12(apt.startTime, apt.endTime)} · ${apt.therapist.fullName}\n${apt.session.service.name}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate text-xs font-semibold leading-tight text-gray-800">{apt.session.patient.fullName}</span>
    </Link>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateSessionModal({
  open, onClose, prefillDate, prefillTime, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  prefillDate: string;
  prefillTime: string;
  onCreated: () => void;
}) {
  const [patients, setPatients]   = useState<Patient[]>([]);
  const [services, setServices]   = useState<Service[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);

  const [patientId,   setPatientId]   = useState("");
  const [serviceId,   setServiceId]   = useState("");
  const [price,       setPrice]       = useState<number | "">(DEFAULT_SESSION_PRICE);
  // Receipt taken at booking time
  const [collectNow,  setCollectNow]  = useState(false);
  const [payAmount,   setPayAmount]   = useState<number | "">("");
  const [payMethod,   setPayMethod]   = useState(""); // payment method id
  const [payRef,      setPayRef]      = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [date,        setDate]        = useState(prefillDate);
  const [startTime,   setStartTime]   = useState(prefillTime);
  const [durationMin, setDurationMin] = useState(DEFAULT_SESSION_MINUTES);
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [addingPatient, setAddingPatient] = useState(false);

  // Sync prefills when modal opens
  useEffect(() => { if (open) { setDate(prefillDate); setStartTime(prefillTime); setError(""); } }, [open, prefillDate, prefillTime]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/patients?take=200").then(r => r.json()),
      fetch("/api/services").then(r => r.json()),
      fetch("/api/therapists?take=100").then(r => r.json()),
    ]).then(([p, s, t]) => {
      setPatients(p.data ?? p);
      setServices((s as Service[]).filter(x => x.defaultDurationMin));
      setTherapists(t.data ?? t);
    });
  }, [open]);

  const endTime = addMins(startTime, durationMin);
  const remainingAfterPay = Math.max(0, (Number(price) || 0) - (collectNow ? Number(payAmount) || 0 : 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (collectNow && Number(payAmount) > 0 && !payMethod) { setError("اختر طريقة الدفع"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId, serviceId, therapistId, date, startTime, endTime,
        price: Number(price) || 0,
        payment: collectNow && Number(payAmount) > 0
          ? { amount: Number(payAmount), paymentMethodId: payMethod, referenceNumber: payRef || undefined }
          : undefined,
      }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
      setSaving(false); return;
    }
    setSaving(false);
    onCreated();
    onClose();
    // reset
    setPatientId(""); setServiceId(""); setTherapistId(""); setNotes(""); setPrice(DEFAULT_SESSION_PRICE); setDurationMin(DEFAULT_SESSION_MINUTES);
    setCollectNow(false); setPayAmount(""); setPayRef("");
  }

  return (
    <Modal open={open} onClose={onClose} title="جلسة جديدة" size="lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
<div className="flex items-center justify-between">
              <label className="label">الحالة <span className="text-red-500">*</span></label>
              <button type="button" onClick={() => setAddingPatient(true)} className="text-xs text-primary-600 hover:underline mb-1">
                + حالة جديدة
              </button>
            </div>
            <select required value={patientId} onChange={e => setPatientId(e.target.value)} className="input">
              <option value="">— اختر حالة —</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">الخدمة <span className="text-red-500">*</span></label>
            <select required value={serviceId} onChange={e => {
              setServiceId(e.target.value);
              const svc = services.find(x => x.id === e.target.value);
              if (svc) {
                // The service's own duration / price, else 60 min / 50 د.ل
                const d = sessionDefaults(svc);
                setDurationMin(d.minutes);
                setPrice(d.price);
                if (collectNow) setPayAmount(d.price);
              }
            }} className="input">
              <option value="">— اختر —</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">المعالج <span className="text-red-500">*</span></label>
            <select required value={therapistId} onChange={e => setTherapistId(e.target.value)} className="input">
              <option value="">— اختر —</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت البدء</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">المدة (دقيقة)</label>
            <input type="number" min={15} step={5} value={durationMin} onChange={e => setDurationMin(+e.target.value)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت الانتهاء</label>
            <input readOnly value={to12(endTime)} className="input bg-gray-50" />
          </div>
          <div>
            <label className="label">قيمة الجلسة (د.ل) <span className="text-red-500">*</span></label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="input"
              dir="ltr"
              placeholder="مثال: 300"
            />
          </div>
        </div>

        {/* ── Receipt taken now ─────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/60">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={collectNow}
              onChange={e => {
                setCollectNow(e.target.checked);
                if (e.target.checked && payAmount === "") setPayAmount(price);
              }}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-sm font-medium text-gray-800">تسجيل إيصال قبض الآن</span>
          </label>

          {collectNow && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label text-xs">المبلغ المقبوض</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  max={Number(price) || undefined}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="input text-sm"
                  dir="ltr"
                />
              </div>
              <PaymentMethodField value={payMethod} onChange={setPayMethod} small />
              <div>
                <label className="label text-xs">رقم المرجع</label>
                <input
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  className="input text-sm"
                  dir="ltr"
                  placeholder="اختياري"
                />
              </div>

              <div className="col-span-2 flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setPayAmount(price)}
                  className="text-primary-600 hover:underline"
                >
                  قبض القيمة كاملة
                </button>
                <span className={remainingAfterPay > 0 ? "text-amber-700" : "text-green-700"}>
                  {remainingAfterPay > 0
                    ? `المتبقي على الحالة: ${remainingAfterPay.toFixed(2)} د.ل`
                    : "✓ مسدّدة بالكامل"}
                </span>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="label">ملاحظات</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" />
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ الجلسة"}</button>
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </form>
      <NewPatientModal
        open={addingPatient}
        onClose={() => setAddingPatient(false)}
        onCreated={(p) => {
          setPatients((list) => [...list, { id: p.id, fullName: p.fullName }]);
          setPatientId(p.id);
        }}
      />
    </Modal>
  );
}

// ─── Hour rows: sessions listed under each other ─────────────────────────────

const MIN_HOUR_HEIGHT = 56; // px — an hour row is never shorter than this
const CHIP_HEIGHT = 22;     // one session line (20px + 2px gap)
const ROW_PADDING = 6;

const minsToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Each session sits in the row of the hour it starts in. */
const startHour = (apt: Appointment) => Math.min(DAY_END - 1, Math.max(DAY_START, Math.floor(timeToMinutes(apt.startTime) / 60)));

// ─── Week / Day Grid ──────────────────────────────────────────────────────────

function TimeGrid({
  days, appointments, onSlotClick, onDayOpen,
}: {
  days: Date[];
  appointments: Appointment[];
  onSlotClick: (date: string, time: string) => void;
  onDayOpen: (day: Date) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  // day → hour → sessions starting in that hour, by start time
  const buckets = days.map((day) => {
    const byHour = new Map<number, Appointment[]>();
    appointments
      .filter((a) => isSameDay(parseISO(a.date), day))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      .forEach((a) => {
        const h = startHour(a);
        byHour.set(h, [...(byHour.get(h) ?? []), a]);
      });
    return byHour;
  });

  // An hour row grows to hold the busiest day in that hour — nothing is hidden
  const rowHeight = HOURS.map((h) =>
    Math.max(MIN_HOUR_HEIGHT, Math.max(0, ...buckets.map((b) => b.get(h)?.length ?? 0)) * CHIP_HEIGHT + ROW_PADDING)
  );
  const rowTop = rowHeight.reduce<number[]>((acc, _h, i) => [...acc, i === 0 ? 0 : acc[i - 1] + rowHeight[i - 1]], []);
  const totalHeight = rowTop[rowTop.length - 1] + rowHeight[rowHeight.length - 1];

  // Open on the afternoon, when the centre is busiest
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (gridRef.current) gridRef.current.scrollTop = rowTop[DEFAULT_HOUR - DAY_START] - 4;
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Click on an empty part of an hour row → book at :00 (top half) or :30 (bottom half). */
  function handleCellClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    let i = rowTop.findIndex((top, k) => y >= top && y < top + rowHeight[k]);
    if (i < 0) i = HOURS.length - 1;
    const half = y - rowTop[i] >= rowHeight[i] / 2 ? 30 : 0;
    onSlotClick(format(day, "yyyy-MM-dd"), minsToTime(HOURS[i] * 60 + half));
  }

  return (
    <div className="card flex flex-1 flex-col overflow-hidden">
      {/* Day headers — click to open that day */}
      <div className="flex border-b border-gray-300/70 bg-white">
        <div className="w-14 shrink-0 border-l border-gray-200" />
        {days.map((day, di) => {
          const n = [...buckets[di].values()].reduce((t, l) => t + l.length, 0);
          const today = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onDayOpen(day)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-l border-gray-100 py-1.5 text-xs font-medium transition hover:bg-gray-50 ${
                today ? "bg-primary-50 text-primary-700" : "text-gray-600"
              }`}
              title="عرض اليوم"
            >
              <span>{DAY_NAMES_SHORT[day.getDay()]}</span>
              <span className={`flex size-6 items-center justify-center rounded-full text-sm font-bold ${
                today ? "bg-primary-600 text-white" : "text-gray-800"
              }`}>
                {format(day, "d")}
              </span>
              {n > 0 && <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-normal text-gray-500">{n}</span>}
            </button>
          );
        })}
      </div>

      {/* Scrollable hours */}
      <div ref={gridRef} className="relative flex-1 overflow-y-auto">
        <div className="flex" style={{ height: totalHeight }}>
          {/* Hour labels */}
          <div className="relative w-14 shrink-0 border-l border-gray-200">
            {HOURS.map((h, i) => (
              <div key={h} className="absolute w-full px-1 pt-1 text-left text-xs text-gray-400" style={{ top: rowTop[i] }}>
                {hour12(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, di) => (
            <div
              key={day.toISOString()}
              className="relative flex-1 cursor-pointer border-l border-gray-100 transition-colors hover:bg-primary-50/20"
              style={{ height: totalHeight }}
              onClick={(e) => handleCellClick(e, day)}
            >
              {HOURS.map((h, i) => (
                <div key={h} className="absolute inset-x-0 border-t border-gray-200" style={{ top: rowTop[i] }} />
              ))}

              {/* Sessions of each hour, one under the other */}
              {HOURS.map((h, i) => {
                const list = buckets[di].get(h);
                if (!list?.length) return null;
                return (
                  <div
                    key={h}
                    className="absolute inset-x-0 z-10 flex flex-col gap-0.5 px-1 pt-1"
                    style={{ top: rowTop[i] }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {list.map((apt) => (
                      <div key={apt.id} className="h-5">
                        <AptCard apt={apt} />
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Now indicator */}
              {isSameDay(day, new Date()) && (() => {
                const now = new Date();
                const i = now.getHours() - DAY_START;
                if (i < 0 || i >= HOURS.length) return null;
                const top = rowTop[i] + (now.getMinutes() / 60) * rowHeight[i];
                return (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top }}>
                    <div className="relative h-0.5 w-full bg-red-400">
                      <div className="absolute -start-1 -top-1.5 size-3 rounded-full bg-red-400" />
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Month Grid ───────────────────────────────────────────────────────────────

const MONTH_CELL_MAX = 3; // sessions listed in a day cell before «+N أخرى»

function MonthGrid({
  current, appointments, onDayClick, onDayOpen,
}: {
  current: Date;
  appointments: Appointment[];
  onDayClick: (date: string) => void;
  onDayOpen: (day: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(current), { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(endOfMonth(current), { weekStartsOn: WEEK_STARTS_ON });
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const weeks = days.length / 7;

  const aptsByDay = (day: Date) =>
    appointments
      .filter((a) => isSameDay(parseISO(a.date), day))
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  return (
    <div className="card flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-300/70 bg-white">
        {WEEK_ORDER.map((d) => DAY_NAMES_SHORT[d]).map((name) => (
          <div key={name} className="py-2.5 text-center text-xs font-medium text-gray-500">{name}</div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 content-start overflow-y-auto" style={{ gridTemplateRows: `repeat(${weeks}, auto)` }}>
        {days.map((day) => {
          const apts = aptsByDay(day);
          const inMonth = isSameMonth(day, current);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(format(day, "yyyy-MM-dd"))}
              className={`group flex min-w-0 cursor-pointer flex-col gap-1 border-b border-l border-gray-200 p-1.5 transition-colors hover:bg-primary-50/30 ${
                inMonth ? "bg-white" : "bg-gray-50"
              }`}
              title="انقر لإضافة جلسة في هذا اليوم"
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDayOpen(day); }}
                  className={`flex size-7 items-center justify-center rounded-full text-sm font-semibold transition ${
                    isToday
                      ? "bg-primary-600 text-white"
                      : inMonth ? "text-gray-800 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-100"
                  }`}
                  title="عرض اليوم"
                >
                  {format(day, "d")}
                </button>
                {apts.length > 0 && (
                  <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-semibold text-primary-600">{apts.length}</span>
                )}
              </div>

              <div className="min-h-[74px] min-w-0 space-y-0.5">
                {apts.slice(0, MONTH_CELL_MAX).map((apt) => (
                  <Link
                    key={apt.id}
                    href={`/sessions/${apt.session.id}`}
                    onClick={(e) => e.stopPropagation()}
                    title={`${range12(apt.startTime, apt.endTime)} · ${apt.session.patient.fullName}\n${apt.therapist.fullName} · ${apt.session.service.name}`}
                    className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[11px] transition hover:bg-gray-100"
                  >
                    <span className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[apt.status] ?? "bg-gray-400"}`} />
                    <span className="shrink-0 whitespace-nowrap text-gray-500">{to12(apt.startTime)}</span>
                    <span className="truncate font-medium text-gray-800">{apt.session.patient.fullName}</span>
                  </Link>
                ))}
                {apts.length > MONTH_CELL_MAX && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDayOpen(day); }}
                    className="w-full rounded-lg px-1.5 py-0.5 text-start text-[11px] font-medium text-primary-600 hover:bg-primary-50"
                  >
                    +{apts.length - MONTH_CELL_MAX} أخرى
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────

export default function SessionsCalendarPage() {
  const [view,        setView]        = useState<View>("week");
  const [current,     setCurrent]     = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [prefillDate, setPrefillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [prefillTime, setPrefillTime] = useState(DEFAULT_TIME);

  // Filters — applied to the loaded range, so switching them is instant
  const [therapistFilter, setTherapistFilter] = useState("");
  const [typeFilter,      setTypeFilter]      = useState<"" | "ADULT" | "CHILD">("");
  const [allTherapists,   setAllTherapists]   = useState<Therapist[]>([]);
  useEffect(() => {
    fetch("/api/therapists?take=100").then(r => (r.ok ? r.json() : null)).then(t => t && setAllTherapists(t.data ?? t));
  }, []);
  const visible = appointments.filter(a =>
    (!therapistFilter || a.therapist.id === therapistFilter) &&
    (!typeFilter || a.session.patient.patientType === typeFilter)
  );
  const filtered = Boolean(therapistFilter || typeFilter);

  // Compute visible range
  const range = useCallback(() => {
    if (view === "day") return { from: current, to: current };
    if (view === "week") return {
      from: startOfWeek(current, { weekStartsOn: WEEK_STARTS_ON }),
      to:   endOfWeek(current,   { weekStartsOn: WEEK_STARTS_ON }),
    };
    return {
      from: startOfWeek(startOfMonth(current), { weekStartsOn: WEEK_STARTS_ON }),
      to:   endOfWeek(endOfMonth(current),     { weekStartsOn: WEEK_STARTS_ON }),
    };
  }, [view, current]);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    const { from, to } = range();
    const res = await fetch(
      `/api/appointments?from=${format(from, "yyyy-MM-dd")}&to=${format(to, "yyyy-MM-dd")}`
    );
    if (res.ok) setAppointments(await res.json());
    setLoading(false);
  }, [range]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  function openCreate(date: string, time = DEFAULT_TIME) {
    setPrefillDate(date);
    setPrefillTime(time);
    setModalOpen(true);
  }

  function openDay(day: Date) {
    setCurrent(day);
    setView("day");
  }

  function navigate(dir: 1 | -1) {
    if (view === "day")   setCurrent(d => addDays(d, dir));
    if (view === "week")  setCurrent(d => addWeeks(d, dir));
    if (view === "month") setCurrent(d => addMonths(d, dir));
  }

  // Week days
  const weekDays = view === "day"
    ? [current]
    : Array.from({ length: 7 }, (_, i) =>
        addDays(startOfWeek(current, { weekStartsOn: WEEK_STARTS_ON }), i)
      );

  // Title
  const title =
    view === "day"   ? format(current, "EEEE d MMMM yyyy", { locale: arSA }) :
    view === "week"  ? (() => {
      const { from, to } = range();
      return `${format(from, "d MMM", { locale: arSA })} – ${format(to, "d MMM yyyy", { locale: arSA })}`;
    })() :
    format(current, "MMMM yyyy", { locale: arSA });

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>

      {/* Toolbar — row 1: period + view + new session */}
      <div className="mb-2 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(new Date())} className="btn-secondary !h-9 px-3 text-sm">
            اليوم
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(1)} className="grid size-9 place-items-center rounded-full border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-100">
              ‹
            </button>
            <button onClick={() => navigate(-1)} className="grid size-9 place-items-center rounded-full border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-100">
              ›
            </button>
          </div>
          <h2 className="min-w-40 text-base font-semibold text-gray-900">{title}</h2>
          {loading && <span className="text-xs text-gray-400">جارٍ التحميل...</span>}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-gray-100 p-1 text-sm">
            {([["month", "شهر"], ["week", "أسبوع"], ["day", "يوم"]] as [View, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-full px-4 py-1 transition ${view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => openCreate(format(new Date(), "yyyy-MM-dd"))}
            className="btn-primary !h-9 text-sm"
          >
            + جلسة جديدة
          </button>
        </div>
      </div>

      {/* Toolbar — row 2: filters */}
      <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-2">
        <select value={therapistFilter} onChange={e => setTherapistFilter(e.target.value)}
          className={`input !min-h-0 !h-9 w-44 !py-0 text-sm ${therapistFilter ? "border-primary-400 bg-primary-50" : ""}`}>
          <option value="">كل الأخصائيين</option>
          {allTherapists.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
        </select>
        <div className="flex rounded-full bg-gray-100 p-1 text-sm">
          {([["", "الكل"], ["CHILD", "أطفال"], ["ADULT", "بالغون"]] as ["" | "ADULT" | "CHILD", string][]).map(([v, label]) => (
            <button key={v} onClick={() => setTypeFilter(v)}
              className={`rounded-full px-4 py-1 transition ${typeFilter === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>
              {label}
            </button>
          ))}
        </div>
        {filtered && (
          <>
            <span className="whitespace-nowrap text-xs text-gray-500">{visible.length} من {appointments.length}</span>
            <button onClick={() => { setTherapistFilter(""); setTypeFilter(""); }} className="whitespace-nowrap text-xs text-primary-600 hover:underline">
              مسح
            </button>
          </>
        )}
      </div>

      {/* Calendar body */}
      {(view === "day" || view === "week") && (
        <TimeGrid
          key={view}
          days={weekDays}
          appointments={visible}
          onSlotClick={openCreate}
          onDayOpen={openDay}
        />
      )}
      {view === "month" && (
        <MonthGrid
          current={current}
          appointments={visible}
          onDayClick={date => openCreate(date)}
          onDayOpen={openDay}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-shrink-0 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-primary-600" />
          <span>مجدولة</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-green-500" />
          <span>مُقدَّمة</span>
        </div>
        <span className="text-gray-300">|</span>
        <span>انقر على أي وقت لإنشاء جلسة · انقر على رقم اليوم لعرضه</span>
      </div>

      {/* Create modal */}
      <CreateSessionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prefillDate={prefillDate}
        prefillTime={prefillTime}
        onCreated={loadAppointments}
      />
    </div>
  );
}
