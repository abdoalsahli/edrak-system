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

// ─── Constants ───────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64; // px per hour
const DAY_START   = 7;  // 7 am
const DAY_END     = 21; // 9 pm
const HOURS       = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START);

const DAY_NAMES_SHORT = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "bg-primary-100 border-primary-400 text-primary-800",
  DELIVERED: "bg-green-100 border-green-400 text-green-800",
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

function aptTop(startTime: string) {
  const mins = timeToMinutes(startTime) - DAY_START * 60;
  return Math.max(0, (mins / 60) * HOUR_HEIGHT);
}

function aptHeight(startTime: string, endTime: string) {
  const mins = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.max(20, (mins / 60) * HOUR_HEIGHT);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function AptCard({ apt, compact = false }: { apt: Appointment; compact?: boolean }) {
  const color = STATUS_COLOR[apt.status] ?? "bg-gray-100 border-gray-400 text-gray-800";
  return (
    <Link
      href={`/sessions/${apt.session.id}`}
      className={`block border-s-2 rounded px-1.5 py-0.5 overflow-hidden ${color} hover:opacity-80 transition-opacity`}
      title={`${apt.session.patient.fullName} — ${apt.session.service.name}\n${apt.startTime}–${apt.endTime}`}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="font-semibold truncate text-xs leading-tight">{apt.session.patient.fullName}</p>
      {!compact && (
        <>
          <p className="truncate text-xs opacity-75 leading-tight">{apt.session.service.name}</p>
          <p className="truncate text-xs opacity-60 leading-tight" dir="ltr">{apt.startTime}–{apt.endTime}</p>
        </>
      )}
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
  const [price,       setPrice]       = useState<number | "">("");
  // Receipt taken at booking time
  const [collectNow,  setCollectNow]  = useState(false);
  const [payAmount,   setPayAmount]   = useState<number | "">("");
  const [payMethod,   setPayMethod]   = useState(""); // payment method id
  const [payRef,      setPayRef]      = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [date,        setDate]        = useState(prefillDate);
  const [startTime,   setStartTime]   = useState(prefillTime);
  const [durationMin, setDurationMin] = useState(60);
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
    setPatientId(""); setServiceId(""); setTherapistId(""); setNotes(""); setPrice("");
    setCollectNow(false); setPayAmount(""); setPayRef("");
  }

  return (
    <Modal open={open} onClose={onClose} title="جلسة جديدة" size="lg">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
<div className="flex items-center justify-between">
              <label className="label">المريض <span className="text-red-500">*</span></label>
              <button type="button" onClick={() => setAddingPatient(true)} className="text-xs text-primary-600 hover:underline mb-1">
                + مريض جديد
              </button>
            </div>
            <select required value={patientId} onChange={e => setPatientId(e.target.value)} className="input">
              <option value="">— اختر مريضاً —</option>
              {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">الخدمة <span className="text-red-500">*</span></label>
            <select required value={serviceId} onChange={e => {
              setServiceId(e.target.value);
              const svc = services.find(x => x.id === e.target.value);
              if (svc) {
                setDurationMin(svc.defaultDurationMin);
                const p = svc.defaultPrice != null ? Number(svc.defaultPrice) : "";
                setPrice(p);
                if (collectNow) setPayAmount(p);
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
            <input readOnly value={endTime} className="input bg-gray-50" dir="ltr" />
          </div>
          <div>
            <label className="label">قيمة الجلسة (ر.س) <span className="text-red-500">*</span></label>
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
                    ? `المتبقي على المريض: ${remainingAfterPay.toFixed(2)} ر.س`
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

// ─── Week / Day Grid ──────────────────────────────────────────────────────────

function TimeGrid({
  days, appointments, onSlotClick,
}: {
  days: Date[];
  appointments: Appointment[];
  onSlotClick: (date: string, time: string) => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll to 8am on mount
  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = HOUR_HEIGHT;
  }, []);

  function handleCellClick(e: React.MouseEvent<HTMLDivElement>, day: Date) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (e.currentTarget.parentElement?.scrollTop ?? 0);
    const totalMins = DAY_START * 60 + Math.floor(y / HOUR_HEIGHT) * 60;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onSlotClick(format(day, "yyyy-MM-dd"), time);
  }

  const aptsByDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.date), day));

  return (
    <div className="flex flex-col flex-1 overflow-hidden border border-gray-200 rounded-xl">
      {/* Day headers */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <div className="w-14 flex-shrink-0 border-l border-gray-200" />
        {days.map(day => (
          <div
            key={day.toISOString()}
            className={`flex-1 text-center py-2 text-xs font-medium border-l border-gray-100 ${
              isSameDay(day, new Date()) ? "text-primary-700 bg-primary-50" : "text-gray-600"
            }`}
          >
            <div>{DAY_NAMES_SHORT[day.getDay()]}</div>
            <div className={`text-lg font-bold mt-0.5 w-8 h-8 mx-auto rounded-full flex items-center justify-center ${
              isSameDay(day, new Date()) ? "bg-primary-600 text-white" : ""
            }`}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable time area */}
      <div ref={gridRef} className="flex-1 overflow-y-auto relative">
        <div className="flex" style={{ height: HOURS.length * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 flex-shrink-0 border-l border-gray-200 relative">
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute w-full text-left px-1 text-xs text-gray-400"
                style={{ top: (h - DAY_START) * HOUR_HEIGHT - 7 }}
                dir="ltr"
              >
                {h}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => (
            <div
              key={day.toISOString()}
              className="flex-1 border-l border-gray-100 relative cursor-pointer hover:bg-blue-50/20 transition-colors overflow-x-auto"
              style={{ height: HOURS.length * HOUR_HEIGHT }}
              onClick={e => handleCellClick(e, day)}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute w-full border-t border-gray-100"
                  style={{ top: (h - DAY_START) * HOUR_HEIGHT }}
                />
              ))}
              {/* Half-hour lines */}
              {HOURS.map(h => (
                <div
                  key={`${h}-half`}
                  className="absolute w-full border-t border-gray-50"
                  style={{ top: (h - DAY_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                />
              ))}

              {/* Appointments — side-by-side columns for overlapping slots */}
              {(() => {
                const MIN_COL_PX = 110; // minimum readable width per concurrent column
                const apts = aptsByDay(day);

                // Greedy column assignment
                const cols: (typeof apts[number])[][] = [];
                for (const apt of apts) {
                  let placed = false;
                  for (const col of cols) {
                    if (timeToMinutes(col[col.length - 1].endTime) <= timeToMinutes(apt.startTime)) {
                      col.push(apt); placed = true; break;
                    }
                  }
                  if (!placed) cols.push([apt]);
                }

                const aptCol = new Map<string, number>();
                cols.forEach((col, ci) => col.forEach(a => aptCol.set(a.id, ci)));

                // Per apt: how many columns overlap its time window
                const aptTotal = new Map<string, number>();
                for (const apt of apts) {
                  const s = timeToMinutes(apt.startTime);
                  const e = timeToMinutes(apt.endTime);
                  let total = 0;
                  for (const col of cols) {
                    if (col.some(a => timeToMinutes(a.startTime) < e && timeToMinutes(a.endTime) > s)) total++;
                  }
                  aptTotal.set(apt.id, total);
                }

                return apts.map(apt => {
                  const ci = aptCol.get(apt.id) ?? 0;
                  const n  = aptTotal.get(apt.id) ?? 1;
                  const h  = aptHeight(apt.startTime, apt.endTime);
                  // Use percentage width, but never narrower than MIN_COL_PX
                  const pctW = 100 / n;
                  const widthStyle = n === 1
                    ? "calc(100% - 2px)"
                    : `max(${MIN_COL_PX}px, calc(${pctW}% - 2px))`;
                  const leftStyle = n === 1
                    ? "1px"
                    : `max(calc(${ci} * ${MIN_COL_PX}px), calc(${ci * pctW}% + 1px))`;

                  return (
                    <div
                      key={apt.id}
                      className="absolute z-10"
                      style={{
                        top:    aptTop(apt.startTime),
                        height: h,
                        width:  widthStyle,
                        left:   leftStyle,
                      }}
                      onClick={e => e.stopPropagation()}
                    >
                      <AptCard apt={apt} compact={h < 40} />
                    </div>
                  );
                });
              })()}

              {/* Today indicator */}
              {isSameDay(day, new Date()) && (() => {
                const now = new Date();
                const mins = now.getHours() * 60 + now.getMinutes() - DAY_START * 60;
                if (mins < 0 || mins > (DAY_END - DAY_START) * 60) return null;
                return (
                  <div
                    className="absolute inset-x-0 z-20 pointer-events-none"
                    style={{ top: (mins / 60) * HOUR_HEIGHT }}
                  >
                    <div className="h-0.5 bg-red-400 w-full relative">
                      <div className="absolute -start-1 -top-1.5 w-3 h-3 rounded-full bg-red-400" />
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

function MonthGrid({
  current, appointments, onDayClick,
}: {
  current: Date;
  appointments: Appointment[];
  onDayClick: (date: string) => void;
}) {
  const start = startOfWeek(startOfMonth(current), { weekStartsOn: 0 });
  const end   = endOfWeek(endOfMonth(current),     { weekStartsOn: 0 });
  const days: Date[] = [];
  let d = start;
  while (d <= end) { days.push(d); d = addDays(d, 1); }

  const aptsByDay = (day: Date) =>
    appointments.filter(a => isSameDay(parseISO(a.date), day));

  return (
    <div className="flex flex-col flex-1 border border-gray-200 rounded-xl overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
        {DAY_NAMES_SHORT.map(name => (
          <div key={name} className="text-center py-2 text-xs font-medium text-gray-500">{name}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map(day => {
          const apts = aptsByDay(day);
          const inMonth = isSameMonth(day, current);
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(format(day, "yyyy-MM-dd"))}
              className={`aspect-square border-l border-b border-gray-100 p-1.5 cursor-pointer transition-colors hover:bg-blue-50/40 ${
                !inMonth ? "bg-gray-50/60" : ""
              }`}
            >
              <div className="flex justify-end mb-1">
                <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-primary-600 text-white"
                    : inMonth
                    ? "text-gray-700"
                    : "text-gray-300"
                }`}>
                  {format(day, "d")}
                </span>
              </div>
              <div className="space-y-0.5">
                {apts.slice(0, 3).map(apt => (
                  <Link
                    key={apt.id}
                    href={`/sessions/${apt.session.id}`}
                    onClick={e => e.stopPropagation()}
                    className={`block text-xs px-1.5 py-0.5 rounded truncate border-s-2 ${
                      STATUS_COLOR[apt.status] ?? "bg-gray-100 border-gray-400 text-gray-800"
                    }`}
                  >
                    {apt.startTime} {apt.session.patient.fullName}
                  </Link>
                ))}
                {apts.length > 3 && (
                  <p className="text-xs text-gray-400 px-1">+{apts.length - 3} أخرى</p>
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
  const [prefillTime, setPrefillTime] = useState("09:00");

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
      from: startOfWeek(current, { weekStartsOn: 0 }),
      to:   endOfWeek(current,   { weekStartsOn: 0 }),
    };
    return {
      from: startOfWeek(startOfMonth(current), { weekStartsOn: 0 }),
      to:   endOfWeek(endOfMonth(current),     { weekStartsOn: 0 }),
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

  function openCreate(date: string, time = "09:00") {
    setPrefillDate(date);
    setPrefillTime(time);
    setModalOpen(true);
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
        addDays(startOfWeek(current, { weekStartsOn: 0 }), i)
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
    <div className="flex flex-col" style={{ height: "calc(100vh - 48px)" }}>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(new Date())} className="btn-secondary text-sm px-3 py-1.5">
            اليوم
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              ‹
            </button>
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
              ›
            </button>
          </div>
          <h2 className="text-base font-semibold text-gray-900 min-w-48">{title}</h2>
          {loading && <span className="text-xs text-gray-400">جارٍ التحميل...</span>}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <select value={therapistFilter} onChange={e => setTherapistFilter(e.target.value)}
            className={`input text-sm py-1.5 w-44 ${therapistFilter ? "border-primary-400 bg-primary-50" : ""}`}>
            <option value="">كل الأخصائيين</option>
            {allTherapists.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
          </select>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
            {([["", "الكل"], ["CHILD", "أطفال"], ["ADULT", "بالغون"]] as ["" | "ADULT" | "CHILD", string][]).map(([v, label]) => (
              <button key={v} onClick={() => setTypeFilter(v)}
                className={`px-3 py-1.5 ${typeFilter === v ? "bg-primary-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
                {label}
              </button>
            ))}
          </div>
          {filtered && (
            <>
              <span className="text-xs text-gray-500 whitespace-nowrap">{visible.length} من {appointments.length}</span>
              <button onClick={() => { setTherapistFilter(""); setTypeFilter(""); }} className="text-xs text-primary-600 hover:underline whitespace-nowrap">
                مسح
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* View switcher */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
            {([["month", "شهر"], ["week", "أسبوع"], ["day", "يوم"]] as [View, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 ${view === v ? "bg-primary-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => openCreate(format(new Date(), "yyyy-MM-dd"))}
            className="btn-primary text-sm"
          >
            + جلسة جديدة
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {(view === "day" || view === "week") && (
        <TimeGrid
          days={weekDays}
          appointments={visible}
          onSlotClick={openCreate}
        />
      )}
      {view === "month" && (
        <MonthGrid
          current={current}
          appointments={visible}
          onDayClick={date => openCreate(date)}
        />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 flex-shrink-0 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-primary-100 border-s-2 border-primary-400" />
          <span>مجدولة</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-green-100 border-s-2 border-green-400" />
          <span>مُقدَّمة</span>
        </div>
        <span className="text-gray-300">|</span>
        <span>انقر على أي وقت أو يوم لإنشاء جلسة</span>
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
