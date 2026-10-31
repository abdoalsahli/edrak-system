"use client";

import { readApiError } from "@/lib/apiError";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { AlertTriangle, Pencil } from "lucide-react";
import { EditSessionModal } from "@/components/sessions/EditSessionModal";
import { PatientAccountCard } from "@/components/finance/PatientAccountCard";
import { range12 } from "@/lib/time12";

const STATUS_MAP: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" | "default" }> = {
  PENDING:              { label: "مجدولة",       variant: "default" },
  COMPLETED:            { label: "مكتملة",       variant: "success" },
  ABSENT:               { label: "غياب",          variant: "danger"  },
  CANCELLED_BY_PATIENT: { label: "ألغت الحالة",  variant: "gray"    },
  CANCELLED_BY_CENTER:  { label: "ألغى المركز",  variant: "gray"    },
};

type Appointment = {
  id: string; date: string; startTime: string; endTime: string;
  status: string; isMakeup: boolean;
  therapist: { id: string; fullName: string };
  room?: { name: string } | null;
};

type InvoiceRef = { id: string; status: string; totalAmount: number; paidAmount: number };

type InvoiceLine = {
  id: string; description: string; qty: number;
  unitPrice: number; discount: number; total: number;
  invoice: { id: string; status: string; totalAmount: number; paidAmount: number };
};

type Commission = {
  id: string;
  commissionType: "PERCENTAGE" | "FIXED";
  rate: number | null; baseAmount: number | null; amount: number;
  isPaid: boolean; paidAt: string | null;
  therapist: { fullName: string };
};

type SessionData = {
  id: string; status: string; outcomeNotes: string | null;
  deliveredAt: string | null; createdAt: string;
  programSequenceNumber: number | null;
  patient:  { id: string; fullName: string };
  service:  { name: string };
  serviceId: string;
  price: number | null;
  isCharged: boolean;
  program:  { id: string; invoice: InvoiceRef | null } | null;
  standaloneInvoice: InvoiceRef | null;
  appointments: Appointment[];
  invoiceLines: InvoiceLine[];
  commission:   Commission | null;
};

const fmt = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل`;

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<SessionData | null>(null);

  const [outcomeModal,    setOutcomeModal]    = useState(false);
  const [outcomeStatus,   setOutcomeStatus]   = useState("COMPLETED");
  const [outcomeNotes,    setOutcomeNotes]    = useState("");
  // An absence or cancellation is never charged automatically — the user is asked
  const [chargeAsk,       setChargeAsk]       = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [editModal,       setEditModal]       = useState(false);
  const [newDate,         setNewDate]         = useState("");
  const [newStartTime,    setNewStartTime]    = useState("15:00");
  const [durationMin,     setDurationMin]     = useState(60);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}`);
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function recordOutcome(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (outcomeStatus === "COMPLETED") submitOutcome();
    else setChargeAsk(true);
  }

  async function submitOutcome(charge?: boolean) {
    setSaving(true); setError("");
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: outcomeStatus, outcomeNotes, charge }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
      setChargeAsk(false);
    } else {
      setOutcomeModal(false);
      setChargeAsk(false);
      load();
    }
    setSaving(false);
  }

  async function deleteSession() {
    if (!data) return;
    if (!confirm("حذف هذه الجلسة نهائياً؟ سيُحذف موعدها، وفاتورتها إن لم يكن عليها دفعات.")) return;
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert(await readApiError(res, "تعذّر حذف الجلسة"));
      return;
    }
    router.push(data.program ? `/programs/${data.program.id}` : "/sessions");
  }

  async function toggleCharge() {
    if (!data) return;
    const next = !data.isCharged;
    if (!confirm(next ? "احتساب قيمة هذه الجلسة على الحالة؟" : "إلغاء احتساب قيمة هذه الجلسة؟")) return;
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setCharge", charge: next }),
    });
    if (!res.ok) {
      alert(await readApiError(res, "تعذّر تغيير الاحتساب (يتطلب صلاحية المدير)"));
    }
    load();
  }

  async function reschedule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reschedule", date: newDate, startTime: newStartTime, durationMin }),
    });
    if (!res.ok) {
      setError(await readApiError(res));
    } else { setRescheduleModal(false); load(); }
    setSaving(false);
  }

  if (!data) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const st = STATUS_MAP[data.status] ?? { label: data.status, variant: "gray" };
  // Held or still booked sessions count; an absence or cancellation only when charged
  const counts = data.status === "PENDING" || data.status === "COMPLETED" || data.isCharged;
  const charged = counts ? Number(data.price ?? 0) : 0;
  const activeApt = data.appointments.find((a) => a.status !== "CANCELLED");

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title={`جلسة — ${data.service.name}${data.programSequenceNumber ? ` (#${data.programSequenceNumber})` : ""}`}
        description={
          <span className="flex items-center gap-2">
            <Link href={`/patients/${data.patient.id}`} className="text-primary-600 hover:underline">
              {data.patient.fullName}
            </Link>
            {data.program && (
              <Link href={`/programs/${data.program.id}`} className="text-xs text-gray-500 hover:underline">
                ← البرنامج
              </Link>
            )}
          </span>
        }
        action={
          data.status === "PENDING" ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setOutcomeModal(true)} className="btn-primary">تسجيل النتيجة</button>
              <button onClick={() => setEditModal(true)} className="btn-secondary"><Pencil className="size-4" />تعديل</button>
              {activeApt && <button onClick={() => setRescheduleModal(true)} className="btn-secondary">إعادة جدولة</button>}
              <button onClick={deleteSession} className="btn-danger">حذف</button>
            </div>
          ) : null
        }
      />

      {/* Session info */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">الحالة:</span> <Badge variant={st.variant}>{st.label}</Badge></div>
          <div><span className="text-gray-500">الخدمة:</span> {data.service.name}</div>
          <div>
            <span className="text-gray-500">قيمة الجلسة:</span>{" "}
            {data.price != null && Number(data.price) > 0 ? (
              <span className="font-medium" dir="ltr">{Number(data.price).toFixed(2)} د.ل</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="size-3.5" />بدون قيمة</span>
            )}
            {["ABSENT", "CANCELLED_BY_PATIENT", "CANCELLED_BY_CENTER"].includes(data.status) && (
              <span className="ms-2 inline-flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${data.isCharged ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600"}`}>
                  {data.isCharged ? "محتسبة على الحالة" : "غير محتسبة"}
                </span>
                <button type="button" onClick={toggleCharge} className="text-xs text-primary-600 hover:underline">
                  {data.isCharged ? "إلغاء الاحتساب" : "احتساب القيمة"}
                </button>
              </span>
            )}
          </div>
          <div><span className="text-gray-500">الحالة:</span> <Link href={`/patients/${data.patient.id}`} className="text-primary-600 hover:underline">{data.patient.fullName}</Link></div>
          <div><span className="text-gray-500">تاريخ الإنشاء:</span> {format(parseISO(data.createdAt), "d MMM yyyy", { locale: arSA })}</div>
          {data.deliveredAt && (
            <div><span className="text-gray-500">تاريخ التسليم:</span> {format(parseISO(data.deliveredAt), "d MMM yyyy", { locale: arSA })}</div>
          )}
        </div>
        {data.outcomeNotes && (
          <div>
            <p className="text-xs text-gray-500 mb-1">الملاحظات</p>
            <p className="text-sm bg-gray-50 rounded-lg p-3">{data.outcomeNotes}</p>
          </div>
        )}
      </div>

      {/* Appointments */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">المواعيد</h2>
        {data.appointments.length === 0 ? (
          <p className="text-gray-400 text-sm">لا توجد مواعيد</p>
        ) : (
          <div className="space-y-2">
            {data.appointments.map((a) => (
              <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg border text-sm ${a.status === "CANCELLED" ? "opacity-50 bg-gray-50" : "bg-white"}`}>
                <div>
                  <span className="font-medium">{format(parseISO(a.date), "EEEE d MMM yyyy", { locale: arSA })}</span>
                  <span className="text-gray-500 mx-2">{range12(a.startTime, a.endTime)}</span>
                  {a.isMakeup && <Badge variant="info">تعويضي</Badge>}
                </div>
                <div className="text-xs text-gray-500">
                  {a.therapist.fullName} {a.room ? `· ${a.room.name}` : ""}
                  <span className="ms-2">
                    {a.status === "SCHEDULED" ? "مجدول" : a.status === "DELIVERED" ? "✓ مُقدَّم" : "ملغي"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Money: the session's value on the patient's account ───────── */}
      <div className="empty:hidden">
        <PatientAccountCard
          patientId={data.patient.id}
          charged={charged}
          chargedLabel={data.program ? "قيمة هذه الجلسة (ضمن البرنامج)" : "قيمة الجلسة على حساب الحالة"}
          chargedHint={
            data.program
              ? "مقيّدة على الحساب ضمن قيمة البرنامج"
              : charged === 0 ? "غير محتسبة على الحالة" : undefined
          }
        />
      </div>

      {/* ─── Commission panel ──────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">عمولة المعالج</h2>
          <Link href="/finance/reports/commissions" className="text-xs text-primary-600 hover:underline">تقرير العمولات ←</Link>
        </div>
        {!data.commission ? (
          <p className="text-sm text-gray-400">
            {data.status === "COMPLETED"
              ? "لم تُحسب عمولة (تأكد من ضبط نسبة العمولة على المعالج وإضافة الجلسة للفاتورة أولاً)"
              : "تُحسب العمولة تلقائياً عند إكمال الجلسة"}
          </p>
        ) : (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
            <div>
              <p className="font-medium">{data.commission.therapist.fullName}</p>
              <p className="text-xs text-gray-500" dir="ltr">
                {data.commission.commissionType === "PERCENTAGE" && data.commission.rate
                  ? `${Number(data.commission.rate).toFixed(1)}% × ${fmt(Number(data.commission.baseAmount))}`
                  : "مبلغ ثابت"}
              </p>
            </div>
            <div className="text-left">
              <p className="font-semibold text-primary-700" dir="ltr">{fmt(Number(data.commission.amount))}</p>
              <span className={`text-xs ${data.commission.isPaid ? "text-green-600" : "text-yellow-600"}`}>
                {data.commission.isPaid ? "✓ مدفوعة" : "مستحقة"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Outcome Modal */}
      <Modal open={outcomeModal} onClose={() => { setOutcomeModal(false); setChargeAsk(false); }} title="تسجيل نتيجة الجلسة">
        {chargeAsk ? (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="font-semibold text-amber-900">هل تريد احتساب قيمة الجلسة؟</p>
              <p className="text-sm text-amber-800 mt-1">
                {({ ABSENT: "غياب", CANCELLED_BY_PATIENT: "إلغاء من الحالة", CANCELLED_BY_CENTER: "إلغاء من المركز" } as Record<string, string>)[outcomeStatus]}
                {" — "}قيمة الجلسة{" "}
                <strong dir="ltr">{Number(data.price ?? 0).toFixed(2)} د.ل</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={saving} onClick={() => submitOutcome(true)} className="btn-primary">
                {saving ? "جارٍ الحفظ..." : "نعم، احتسب القيمة"}
              </button>
              <button type="button" disabled={saving} onClick={() => submitOutcome(false)} className="btn-secondary">
                لا، لا تحتسب
              </button>
              <button type="button" disabled={saving} onClick={() => setChargeAsk(false)} className="text-sm text-gray-500 hover:underline">
                رجوع
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={recordOutcome} className="space-y-4">
          <div>
            <label className="label">النتيجة</label>
            <select value={outcomeStatus} onChange={(e) => setOutcomeStatus(e.target.value)} className="input">
              <option value="COMPLETED">مكتملة</option>
              <option value="ABSENT">غياب (بدون إشعار)</option>
              <option value="CANCELLED_BY_PATIENT">ألغت الحالة (مع إشعار)</option>
              <option value="CANCELLED_BY_CENTER">ألغى المركز</option>
            </select>
          </div>
          <div>
            <label className="label">ملاحظات</label>
            <textarea value={outcomeNotes} onChange={(e) => setOutcomeNotes(e.target.value)} rows={3} className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
            <button type="button" onClick={() => setOutcomeModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </form>
        )}
      </Modal>

      {/* Reschedule Modal */}
      <Modal open={rescheduleModal} onClose={() => setRescheduleModal(false)} title="إعادة جدولة الموعد">
        <form onSubmit={reschedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">التاريخ الجديد</label>
              <input required type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">وقت البدء</label>
              <input required type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} className="input" dir="ltr" />
            </div>
            <div>
              <label className="label">المدة (دقيقة)</label>
              <input type="number" min={15} value={durationMin} onChange={(e) => setDurationMin(parseInt(e.target.value))} className="input" dir="ltr" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary">{saving ? "جارٍ الحفظ..." : "إعادة الجدولة"}</button>
            <button type="button" onClick={() => setRescheduleModal(false)} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      </Modal>
      {data.status === "PENDING" && (
        <EditSessionModal
          open={editModal}
          onClose={() => setEditModal(false)}
          onSaved={load}
          session={{
            id: data.id,
            serviceId: data.serviceId,
            price: data.price,
            inProgram: !!data.program,
            appointment: activeApt
              ? { therapistId: activeApt.therapist.id, date: activeApt.date, startTime: activeApt.startTime, endTime: activeApt.endTime }
              : null,
          }}
        />
      )}
    </div>
  );
}
