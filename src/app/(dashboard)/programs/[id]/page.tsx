"use client";

import { readApiError } from "@/lib/apiError";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { StatCard } from "@/components/ui/StatCard";
import { CalendarCog, PlusCircle, Ban, CheckCircle2, ClipboardList, Wallet, Percent } from "lucide-react";
import { range12 } from "@/lib/time12";

const moneyLD = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل`;

const SESSION_STATUS: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" | "default" }> = {
  PENDING: { label: "مجدولة", variant: "default" },
  COMPLETED: { label: "مكتملة", variant: "success" },
  ABSENT: { label: "غياب", variant: "danger" },
  CANCELLED_BY_PATIENT: { label: "ألغى المريض", variant: "gray" },
  CANCELLED_BY_CENTER: { label: "ألغى المركز", variant: "gray" },
};

const PROG_STATUS: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" | "default" | "info" }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  COMPLETED: { label: "مكتمل", variant: "info" },
  EXTENDED: { label: "ممتد", variant: "warning" },
  CANCELLED: { label: "ملغي", variant: "danger" },
};

type BillingCycleRow = {
  id: string;
  cycleNumber: number;
  cycleType: string;
  periodStart: string;
  periodEnd: string;
  expectedSessions: number;
  status: string;
  invoices: {
    id: string; status: string;
    totalAmount: number; paidAmount: number; issueDate: string;
  }[];
};

type ProgramData = {
  id: string;
  status: string;
  plannedSessions: number;
  sessionPrice: number | null;
  sessionCommission: number | null;
  consumedSessions: number;
  remainingSessions: number;
  sessionsPerWeek: number;
  startDate: string;
  expectedEndDate: string;
  notes: string | null;
  cancellationReason: string | null;
  patient:   { id: string; fullName: string };
  therapist: { id: string; fullName: string };
  service:   { name: string; defaultDurationMin: number };
  sessions:  SessionRow[];
  billingCycles: BillingCycleRow[];
};

type SessionRow = {
  id: string;
  status: string;
  programSequenceNumber: number | null;
  outcomeNotes: string | null;
  appointments: { id: string; date: string; startTime: string; endTime: string; status: string; therapist: { fullName: string } }[];
};

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ProgramData | null>(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/programs/${id}`);
    if (res.ok) setData(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function doAction(body: object) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/programs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(await readApiError(res));
    } else {
      load();
    }
    setSaving(false);
  }

  if (!data) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const pct = data.plannedSessions > 0 ? Math.round((data.consumedSessions / data.plannedSessions) * 100) : 0;
  const ps = PROG_STATUS[data.status] ?? { label: data.status, variant: "gray" };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={data.service.name}
        description={
          <Link href={`/patients/${data.patient.id}`} className="text-primary-600 hover:underline">
            {data.patient.fullName}
          </Link>
        }
        action={
          data.status === "ACTIVE" || data.status === "EXTENDED" ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/programs/${id}/edit`} className="btn-secondary"><CalendarCog className="size-4" />تعديل المواعيد</Link>
              <Link href={`/programs/${id}/extend`} className="btn-secondary"><PlusCircle className="size-4" />تمديد</Link>
              <button onClick={() => setCancelModal(true)} className="btn-secondary"><Ban className="size-4" />إلغاء</button>
              <button
                onClick={() => {
                  const left = data.sessions.filter((s) => s.status === "PENDING").length;
                  const msg = left > 0
                    ? `يوجد ${left} جلسة لم تُعقد — سيتم إلغاؤها مع مواعيدها، وتُعدَّل قيمة البرنامج والعمولة على الجلسات المنفّذة فقط. هل تريد إتمام البرنامج؟`
                    : "هل تريد إتمام البرنامج؟";
                  if (confirm(msg)) doAction({ action: "complete" });
                }}
                disabled={saving}
                className="btn-primary"
              >
                <CheckCircle2 className="size-4" />
                إتمام البرنامج
              </button>
            </div>
          ) : null
        }
      />

      {/* Stats */}
      <div className="mb-6 grid gap-5 md:grid-cols-3">
        <StatCard label="التقدّم" value={`${data.consumedSessions} / ${data.plannedSessions}`} icon={ClipboardList} tone="primary"
          hint={`متبقي ${data.remainingSessions} جلسة`} />
        <StatCard label="قيمة الجلسة" value={`${Number(data.sessionPrice ?? 0).toLocaleString("en-US")} د.ل`} icon={Wallet} tone="success"
          hint={`الإجمالي ${(Number(data.sessionPrice ?? 0) * data.plannedSessions).toLocaleString("en-US")} د.ل`} />
        <StatCard label="عمولة الجلسة" value={`${Number(data.sessionCommission ?? 0).toLocaleString("en-US")} د.ل`} icon={Percent} tone="warning"
          hint="قابلة للتعديل من المدير" />
      </div>

      {/* Details */}
      <div className="card mb-6 grid gap-4 p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-gray-500">المعالج</p><p className="mt-1 font-medium text-gray-800">{data.therapist.fullName}</p></div>
        <div><p className="text-gray-500">تاريخ البدء</p><p className="mt-1 font-medium text-gray-800">{format(new Date(data.startDate), "d MMM yyyy", { locale: arSA })}</p></div>
        <div><p className="text-gray-500">الانتهاء المتوقع</p><p className="mt-1 font-medium text-gray-800">{format(new Date(data.expectedEndDate), "d MMM yyyy", { locale: arSA })}</p></div>
        <div><p className="text-gray-500">جلسات أسبوعياً</p><p className="mt-1 font-medium text-gray-800">{data.sessionsPerWeek}</p></div>
        {data.notes && <div className="sm:col-span-2 lg:col-span-4"><p className="text-gray-500">ملاحظات</p><p className="mt-1 text-gray-800">{data.notes}</p></div>}
        {data.cancellationReason && (
          <div className="sm:col-span-2 lg:col-span-4 text-red-600"><span className="font-medium">سبب الإلغاء:</span> {data.cancellationReason}</div>
        )}
      </div>

      {/* Sessions */}
      <div className="card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">جلسات البرنامج</h2>
          <Badge variant={ps.variant}>{ps.label}</Badge>
        </div>
        <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gradient-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-gray-500">
                <th className="whitespace-nowrap px-3 py-3 text-start font-medium">#</th>
                <th className="whitespace-nowrap px-3 py-3 text-start font-medium">التاريخ</th>
                <th className="whitespace-nowrap px-3 py-3 text-start font-medium">الوقت</th>
                <th className="whitespace-nowrap px-3 py-3 text-start font-medium">الحالة</th>
                <th className="whitespace-nowrap px-3 py-3 text-start font-medium">ملاحظات</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300/70">
              {data.sessions.map((s) => {
                const apt = s.appointments[0];
                const ss = SESSION_STATUS[s.status] ?? { label: s.status, variant: "gray" };
                return (
                  <tr key={s.id}>
                    <td className="px-3 py-3 font-medium text-gray-800">{s.programSequenceNumber}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-800">{apt ? format(new Date(apt.date), "EEEE d MMM", { locale: arSA }) : "—"}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600">{apt ? range12(apt.startTime, apt.endTime) : "—"}</td>
                    <td className="px-3 py-3"><Badge variant={ss.variant}>{ss.label}</Badge></td>
                    <td className="px-3 py-3 text-xs text-gray-500">{s.outcomeNotes ?? ""}</td>
                    <td className="px-3 py-3 text-end"><Link href={`/sessions/${s.id}`} className="text-xs font-medium text-primary-600 hover:underline">تفاصيل</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

      {/* ─── Billing cycles ──────────────────────────────────────── */}
      <div className="card mt-6">
        <div className="flex items-center justify-between border-b border-gray-300/70 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">الفوترة</h2>
          <Link href={`/billing/new?programId=${id}`} className="text-xs text-primary-600 hover:underline">
            + دورة فوترة جديدة
          </Link>
        </div>
        {(!data.billingCycles || data.billingCycles.length === 0) ? (
          <div className="p-6 text-center text-sm text-gray-400">
            لا توجد دورات فوترة — انقر &quot;+ دورة فوترة جديدة&quot; للبدء
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.billingCycles.map(cycle => {
              const cycleTotal = cycle.invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
              const cyclePaid  = cycle.invoices.reduce((s, i) => s + Number(i.paidAmount), 0);
              const CYCLE_STATUS: Record<string, string> = { OPEN: "مفتوحة", INVOICED: "مُفوترة", CLOSED: "مغلقة" };
              return (
                <div key={cycle.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-sm">دورة {cycle.cycleNumber}</span>
                      <span className="text-xs text-gray-500 mx-2" dir="ltr">
                        {format(new Date(cycle.periodStart), "d MMM", { locale: arSA })} –{" "}
                        {format(new Date(cycle.periodEnd),   "d MMM yyyy", { locale: arSA })}
                      </span>
                      <span className="text-xs text-gray-400">({cycle.expectedSessions} جلسة مخططة)</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      cycle.status === "CLOSED" ? "bg-green-100 text-green-700" :
                      cycle.status === "INVOICED" ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>{CYCLE_STATUS[cycle.status] ?? cycle.status}</span>
                  </div>
                  {cycle.invoices.length === 0 ? (
                    <p className="text-xs text-gray-400 mt-1">لا توجد فواتير لهذه الدورة</p>
                  ) : (
                    <div className="space-y-1 mt-2">
                      {cycle.invoices.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2">
                          <Link href={`/billing/${inv.id}`} className="text-primary-600 hover:underline">
                            فاتورة — {format(new Date(inv.issueDate), "d MMM yyyy", { locale: arSA })}
                          </Link>
                          <div className="flex items-center gap-3" dir="ltr">
                            <span className="text-gray-500">
                              {moneyLD(Number(inv.paidAmount))}
                              {" / "}
                              {moneyLD(Number(inv.totalAmount))}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded ${
                              inv.status === "PAID" ? "bg-green-100 text-green-700" :
                              inv.status === "PARTIAL" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {{ DRAFT:"مسودة", ISSUED:"صادرة", PARTIAL:"جزئي", PAID:"مدفوع", VOID:"ملغي" }[inv.status] ?? inv.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs font-medium px-3 pt-1 text-gray-600">
                        <span>الإجمالي</span>
                        <span dir="ltr">
                          {moneyLD(cyclePaid)}
                          {" / "}
                          {moneyLD(cycleTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Modal */}
      <Modal open={cancelModal} onClose={() => setCancelModal(false)} title="إلغاء البرنامج">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">هل أنت متأكد من إلغاء هذا البرنامج؟ لا يمكن التراجع.</p>
          <div>
            <label className="label">سبب الإلغاء (اختياري)</label>
            <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} className="input" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => { doAction({ action: "cancel", reason: cancelReason }); setCancelModal(false); }} disabled={saving} className="btn-danger">تأكيد الإلغاء</button>
            <button onClick={() => setCancelModal(false)} className="btn-secondary">تراجع</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
