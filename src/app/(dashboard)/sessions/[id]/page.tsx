"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

const STATUS_MAP: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" | "default" }> = {
  PENDING:              { label: "مجدولة",       variant: "warning" },
  COMPLETED:            { label: "مكتملة",       variant: "success" },
  ABSENT:               { label: "غياب",          variant: "danger"  },
  CANCELLED_BY_PATIENT: { label: "ألغى المريض",  variant: "gray"    },
  CANCELLED_BY_CENTER:  { label: "ألغى المركز",  variant: "gray"    },
};

type Appointment = {
  id: string; date: string; startTime: string; endTime: string;
  status: string; isMakeup: boolean;
  therapist: { fullName: string };
  room?: { name: string } | null;
};

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
  program:  { id: string } | null;
  appointments: Appointment[];
  invoiceLines: InvoiceLine[];
  commission:   Commission | null;
};

const INV_STATUS: Record<string, string> = {
  DRAFT: "مسودة", ISSUED: "صادرة", PARTIAL: "مدفوعة جزئياً",
  PAID: "مدفوعة", VOID: "ملغاة",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(n);

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SessionData | null>(null);

  const [outcomeModal,    setOutcomeModal]    = useState(false);
  const [outcomeStatus,   setOutcomeStatus]   = useState("COMPLETED");
  const [outcomeNotes,    setOutcomeNotes]    = useState("");
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [newDate,         setNewDate]         = useState("");
  const [newStartTime,    setNewStartTime]    = useState("09:00");
  const [durationMin,     setDurationMin]     = useState(60);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}`);
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function recordOutcome(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: outcomeStatus, outcomeNotes }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.message ?? "حدث خطأ");
    } else { setOutcomeModal(false); load(); }
    setSaving(false);
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
      const d = await res.json();
      setError(d.message ?? "حدث خطأ");
    } else { setRescheduleModal(false); load(); }
    setSaving(false);
  }

  if (!data) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const st = STATUS_MAP[data.status] ?? { label: data.status, variant: "gray" };
  const activeApt = data.appointments.find((a) => a.status !== "CANCELLED");
  const invoiceIds = [...new Set(data.invoiceLines.map(l => l.invoice.id))];

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
            <div className="flex gap-2">
              <button onClick={() => setOutcomeModal(true)} className="btn-primary">تسجيل النتيجة</button>
              {activeApt && <button onClick={() => setRescheduleModal(true)} className="btn-secondary">إعادة جدولة</button>}
            </div>
          ) : null
        }
      />

      {/* Session info */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">الحالة:</span> <Badge variant={st.variant}>{st.label}</Badge></div>
          <div><span className="text-gray-500">الخدمة:</span> {data.service.name}</div>
          <div><span className="text-gray-500">المريض:</span> <Link href={`/patients/${data.patient.id}`} className="text-primary-600 hover:underline">{data.patient.fullName}</Link></div>
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
                  <span className="text-gray-500 mx-2" dir="ltr">{a.startTime} – {a.endTime}</span>
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

      {/* ─── Billing panel ─────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">الفوترة</h2>
          {data.program ? (
            <Link href={`/programs/${data.program.id}`} className="text-xs text-primary-600 hover:underline">
              عرض البرنامج ←
            </Link>
          ) : invoiceIds.length === 0 && (
            <Link href="/billing/new" className="text-xs text-primary-600 hover:underline">
              + إنشاء فاتورة
            </Link>
          )}
        </div>

        {data.invoiceLines.length === 0 ? (
          <p className="text-sm text-gray-400">
            {data.program
              ? "تُدار الفوترة عبر البرنامج ودوراته"
              : "لا توجد فاتورة لهذه الجلسة بعد"}
          </p>
        ) : (
          <div className="space-y-2">
            {data.invoiceLines.map(line => (
              <div key={line.id} className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{line.description}</p>
                  <p className="text-xs text-gray-500">{line.qty} × {fmt(Number(line.unitPrice))}</p>
                </div>
                <div className="text-left">
                  <p className="font-semibold" dir="ltr">{fmt(Number(line.total))}</p>
                  <Link href={`/billing/${line.invoice.id}`} className="text-xs text-primary-600 hover:underline">
                    {INV_STATUS[line.invoice.status] ?? line.invoice.status}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Commission panel ──────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">عمولة المعالج</h2>
          <Link href="/commissions" className="text-xs text-primary-600 hover:underline">كل العمولات ←</Link>
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
      <Modal open={outcomeModal} onClose={() => setOutcomeModal(false)} title="تسجيل نتيجة الجلسة">
        <form onSubmit={recordOutcome} className="space-y-4">
          <div>
            <label className="label">النتيجة</label>
            <select value={outcomeStatus} onChange={(e) => setOutcomeStatus(e.target.value)} className="input">
              <option value="COMPLETED">مكتملة</option>
              <option value="ABSENT">غياب (بدون إشعار)</option>
              <option value="CANCELLED_BY_PATIENT">ألغى المريض (مع إشعار)</option>
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
    </div>
  );
}
