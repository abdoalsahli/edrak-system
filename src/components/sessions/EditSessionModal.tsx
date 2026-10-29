"use client";

import { useEffect, useState } from "react";
import { readApiError } from "@/lib/apiError";
import { Modal } from "@/components/ui/Modal";
import { to12 } from "@/lib/time12";

type Option = { id: string; name?: string; fullName?: string; isActive?: boolean };

export type EditableSession = {
  id: string;
  serviceId: string;
  price: number | null;
  inProgram: boolean;
  appointment: { therapistId: string; date: string; startTime: string; endTime: string } | null;
};

const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * تعديل الجلسة — service, therapist, date / time / duration and value of a session
 * not held yet. The server checks the new slot for conflicts and re-bills.
 */
export function EditSessionModal({ open, session, onClose, onSaved }: {
  open: boolean;
  session: EditableSession;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [services, setServices] = useState<Option[]>([]);
  const [therapists, setTherapists] = useState<Option[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [therapistId, setTherapistId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("15:00");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Start from the session as booked, every time the window opens
  useEffect(() => {
    if (!open) return;
    const a = session.appointment;
    setServiceId(session.serviceId);
    setTherapistId(a?.therapistId ?? "");
    setDate(a ? a.date.slice(0, 10) : "");
    setStartTime(a?.startTime ?? "15:00");
    setDuration(a ? toMins(a.endTime) - toMins(a.startTime) : 60);
    setPrice(session.price != null ? Number(session.price) : "");
    setError("");
    Promise.all([
      fetch("/api/services").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/therapists?take=100").then((r) => (r.ok ? r.json() : [])),
    ]).then(([s, t]) => {
      setServices((s.data ?? s) as Option[]);
      setTherapists((t.data ?? t) as Option[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        ...(session.inProgram ? {} : { serviceId }),
        therapistId,
        date,
        startTime,
        durationMin: duration,
        price: price === "" ? undefined : Number(price),
      }),
    });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    onClose();
    onSaved();
  }

  const priceChanged = price !== "" && Math.abs(Number(price) - Number(session.price ?? 0)) > 0.005;

  return (
    <Modal open={open} onClose={onClose} title="تعديل الجلسة" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">الخدمة</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input" disabled={session.inProgram}>
              {services
                .filter((s) => s.isActive !== false || s.id === session.serviceId)
                .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {session.inProgram && <p className="mt-1 text-xs text-gray-400">جلسة برنامج — خدمتها خدمة البرنامج</p>}
          </div>
          <div>
            <label className="label">الأخصائي <span className="text-red-500">*</span></label>
            <select required value={therapistId} onChange={(e) => setTherapistId(e.target.value)} className="input">
              <option value="">— اختر —</option>
              {therapists
                .filter((t) => t.isActive !== false || t.id === therapistId)
                .map((t) => <option key={t.id} value={t.id}>{t.fullName}</option>)}
            </select>
          </div>
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
            <input type="number" min={15} step={5} value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 0)} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">وقت الانتهاء</label>
            <input readOnly value={startTime && duration > 0 ? to12(toTime(toMins(startTime) + duration)) : ""} className="input bg-gray-50" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">قيمة الجلسة (د.ل)</label>
            <input type="number" min={0} step="0.01" value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input" dir="ltr" />
            {priceChanged && (
              <p className="mt-1 text-xs text-amber-700">
                {session.inProgram
                  ? "ستتغيّر قيمة فاتورة البرنامج، ويُرحَّل الفرق إلى حساب المريض كقيد تعديل."
                  : "ستتغيّر قيمة فاتورة الجلسة، ويُرحَّل الفرق إلى حساب المريض كقيد تعديل."}
              </p>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-400">
          تغيير الأخصائي أو الموعد يُلغي الموعد الحالي ويُنشئ موعداً جديداً بعد التحقق من عدم التعارض، ويُسجَّل التعديل في سجل الجلسة.
        </p>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}
