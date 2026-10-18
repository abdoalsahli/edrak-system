"use client";

import { readApiError } from "@/lib/apiError";
import { PaymentMethodField } from "@/components/finance/PaymentMethodField";
import { NewPatientModal } from "@/components/patients/NewPatientModal";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScheduleRhythmFields, daysMatch, daysMismatchMessage } from "@/components/programs/ScheduleRhythmFields";
import { ScheduleCalendar, ScheduleWarnings, fmtDateAr, type ProposedApt } from "@/components/programs/ScheduleCalendar";

type Patient = { id: string; fullName: string };
type Service = { id: string; name: string; deliveryType: string; defaultDurationMin: number; defaultSessionsPerWeek?: number | null; defaultTotalSessions?: number | null; defaultPrice?: number | null };
type Therapist = { id: string; fullName: string };

type Step = "config" | "preview" | "confirm";

const r2 = (n: number) => Math.round(n * 100) / 100;

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
  // The programme is agreed as totals; per-session values are derived from them
  const [totalValue, setTotalValue] = useState<number | "">("");
  const [totalCommission, setTotalCommission] = useState<number | "">("");
  const [defaultStartTime, setDefaultStartTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  // Session days — must be exactly as many as sessions per week
  const [allowedDays, setAllowedDays] = useState<number[]>([0, 2, 4]); // Sun, Tue, Thu for the default 3/week

  const [step, setStep] = useState<Step>("config");
  const [proposed, setProposed] = useState<ProposedApt[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [addingPatient, setAddingPatient] = useState(false);
  // Down payment captured at registration
  const [collectNow, setCollectNow] = useState(false);
  const [payAmount,  setPayAmount]  = useState<number | "">("");
  const [payMethod,  setPayMethod]  = useState(""); // payment method id
  const [payRef,     setPayRef]     = useState("");

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
      const sessions = s.defaultTotalSessions ?? totalSessions;
      setTotalValue(s.defaultPrice != null ? r2(Number(s.defaultPrice) * sessions) : "");
      if (s.defaultSessionsPerWeek) setSessionsPerWeek(s.defaultSessionsPerWeek);
      if (s.defaultTotalSessions) setTotalSessions(s.defaultTotalSessions);
    }
  }

  async function generatePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!daysOk) { setError(daysMismatchMessage(sessionsPerWeek)); return; }
    setError("");
    setLoading(true);
    const res = await fetch("/api/programs/schedule-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, therapistId, startDate, totalSessions, sessionsPerWeek, durationMin, defaultStartTime, allowedDays }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
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
    if (collectNow && Number(payAmount) > 0 && !payMethod) { setError("اختر طريقة الدفع"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/programs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId, serviceId, therapistId, startDate, sessionsPerWeek, totalSessions, durationMin, defaultStartTime, notes,
        totalValue: Number(totalValue) || 0,
        totalCommission: Number(totalCommission) || 0,
        payment: collectNow && Number(payAmount) > 0
          ? { amount: Number(payAmount), paymentMethodId: payMethod, referenceNumber: payRef || undefined }
          : undefined,
        appointments: proposed,
      }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
      setSaving(false);
      return;
    }
    const data = await res.json();
    router.push(`/programs/${data.id}`);
  }

  const daysOk = daysMatch(allowedDays, sessionsPerWeek);

  if (step === "preview") {
    // Program value is based on the sessions actually scheduled
    const programTotal = r2(Number(totalValue) || 0);
    const programCommission = r2(Number(totalCommission) || 0);
    const perSession = proposed.length > 0 ? r2(programTotal / proposed.length) : 0;
    const perSessionCommission = proposed.length > 0 ? r2(programCommission / proposed.length) : 0;
    const remainingAfterPay = Math.max(0, programTotal - (collectNow ? Number(payAmount) || 0 : 0));

    return (
      <div className="max-w-4xl">
        <PageHeader title="معاينة الجدول" />

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: "إجمالي الجلسات", value: proposed.length, color: "text-primary-700 bg-primary-50" },
            { label: "قيمة البرنامج", value: `${programTotal.toFixed(2)} ر.س`, color: "text-blue-700 bg-blue-50" },
            { label: "تاريخ البدء", value: proposed[0] ? fmtDateAr(proposed[0].date).split("،")[1].trim() : "—", color: "text-gray-700 bg-gray-50" },
            { label: "تاريخ الانتهاء", value: proposed.at(-1) ? fmtDateAr(proposed.at(-1)!.date).split("،")[1].trim() : "—", color: "text-gray-700 bg-gray-50" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
              <p className="text-xs opacity-70">{s.label}</p>
              <p className="font-bold text-lg">{s.value}</p>
            </div>
          ))}
        </div>

        <ScheduleWarnings conflicts={conflicts} generated={proposed.length} requested={totalSessions} />

        <ScheduleCalendar proposed={proposed} onChange={setProposed} durationMin={durationMin} />

        <div className="card p-4 mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500">قيمة الجلسة الواحدة</p>
            <p className="font-bold text-gray-800 mt-0.5" dir="ltr">{perSession.toFixed(2)} ر.س</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">عمولة الأخصائي من كل جلسة</p>
            <p className="font-bold text-amber-700 mt-0.5" dir="ltr">{perSessionCommission.toFixed(2)} ر.س</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">إجمالي العمولة على البرنامج</p>
            <p className="font-bold text-amber-700 mt-0.5" dir="ltr">{programCommission.toFixed(2)} ر.س</p>
          </div>
        </div>

        {/* ── Down payment ──────────────────────────────────────────── */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60 mt-5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={collectNow}
              onChange={e => {
                setCollectNow(e.target.checked);
                if (e.target.checked && payAmount === "") setPayAmount(programTotal);
              }}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-sm font-medium text-gray-800">تسجيل إيصال قبض الآن (دفعة مقدّمة)</span>
          </label>

          {collectNow && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label text-xs">المبلغ المقبوض</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  max={programTotal || undefined}
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
                <div className="flex gap-3">
                  <button type="button" onClick={() => setPayAmount(programTotal)} className="text-primary-600 hover:underline">
                    القيمة كاملة
                  </button>
                  <button type="button" onClick={() => setPayAmount(Math.round(programTotal / 2 * 100) / 100)} className="text-primary-600 hover:underline">
                    النصف
                  </button>
                  <button type="button" onClick={() => setPayAmount(perSession)} className="text-primary-600 hover:underline">
                    قيمة جلسة واحدة
                  </button>
                </div>
                <span className={remainingAfterPay > 0 ? "text-amber-700 font-medium" : "text-green-700 font-medium"}>
                  {remainingAfterPay > 0
                    ? `الرصيد المستحق على المريض: ${remainingAfterPay.toFixed(2)} ر.س`
                    : "✓ مسدّد بالكامل"}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600 mt-3 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={confirmAndSave} disabled={saving || proposed.length === 0} className="btn-primary">
            {saving
              ? "جارٍ الحفظ..."
              : collectNow && Number(payAmount) > 0
              ? `✓ تأكيد وإنشاء البرنامج — ${proposed.length} جلسة + قبض ${Number(payAmount).toFixed(2)} ر.س`
              : `✓ تأكيد وإنشاء البرنامج — ${proposed.length} جلسة`}
          </button>
          <button onClick={() => setStep("config")} className="btn-secondary">← تعديل الإعدادات</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="برنامج علاجي جديد" />

      <form onSubmit={generatePreview} className="card p-6 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="label">المريض <span className="text-red-500">*</span></label>
            <button type="button" onClick={() => setAddingPatient(true)} className="text-xs text-primary-600 hover:underline mb-1">
              + مريض جديد
            </button>
          </div>
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

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">تاريخ البدء <span className="text-red-500">*</span></label>
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
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">إجمالي قيمة البرنامج (ر.س) <span className="text-red-500">*</span></label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={totalValue}
              onChange={(e) => setTotalValue(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="input"
              dir="ltr"
              placeholder="مثال: 2400"
            />
          </div>
          <div>
            <label className="label">إجمالي عمولة الأخصائي (ر.س)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={totalCommission}
              onChange={(e) => setTotalCommission(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="input"
              dir="ltr"
              placeholder="مثال: 720"
            />
          </div>
        </div>

        {Number(totalValue) > 0 && totalSessions > 0 && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm text-primary-900">
              <span>قيمة الجلسة الواحدة ({totalSessions} جلسة)</span>
              <span className="font-bold" dir="ltr">{r2(Number(totalValue) / totalSessions).toFixed(2)} ر.س</span>
            </div>
            <div className="flex items-center justify-between text-sm text-primary-800">
              <span>عمولة الأخصائي من كل جلسة</span>
              <span className="font-bold" dir="ltr">{r2((Number(totalCommission) || 0) / totalSessions).toFixed(2)} ر.س</span>
            </div>
            <div className="flex items-center justify-between text-xs text-primary-700 pt-1.5 border-t border-primary-100">
              <span>صافي المركز من البرنامج</span>
              <span className="font-bold" dir="ltr">{r2(Number(totalValue) - (Number(totalCommission) || 0)).toFixed(2)} ر.س</span>
            </div>
            {Number(totalCommission) > Number(totalValue) && (
              <p className="text-xs text-red-600 pt-1">العمولة تتجاوز قيمة البرنامج</p>
            )}
          </div>
        )}

        <div>
          <label className="label">ملاحظات</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading || !daysOk} className="btn-primary">
            {loading ? "جارٍ المعالجة..." : "معاينة الجدول →"}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-secondary">إلغاء</button>
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
    </div>
  );
}
