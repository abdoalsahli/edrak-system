"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { ClipboardCheck, FileClock, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { monthAr } from "@/lib/casePlans/options";
import type { CaseTask, ReviewItem } from "@/lib/casePlans/CycleService";

const TASK: Record<CaseTask["kind"], string> = {
  PLAN_MISSING: "كتابة الخطة العلاجية",
  PLAN_DRAFT: "إكمال الخطة وإرسالها",
  PLAN_RETURNED: "تعديل الخطة (أعادتها الإدارة)",
  REPORT_DUE: "كتابة تقرير المتابعة",
  REPORT_DRAFT: "إكمال التقرير وإرساله",
  REPORT_RETURNED: "تعديل التقرير (أعادته الإدارة)",
};

const day = (iso: string | null) => (iso ? format(new Date(iso), "d MMM", { locale: arSA }) : null);

/**
 * What is waiting on plans and reports — a therapist sees their own work, the
 * manager everyone's plus the review queue. Links open the cycle in the
 * viewer's own pages (therapist portal or management).
 */
export function TasksBoard({ mode }: { mode: "therapist" | "manager" }) {
  const [data, setData] = useState<{ tasks: CaseTask[]; reviews: ReviewItem[] } | null>(null);
  useEffect(() => {
    fetch("/api/case-plans/tasks").then((r) => (r.ok ? r.json() : { tasks: [], reviews: [] })).then(setData);
  }, []);
  const href = (programId: string, cycle: number) =>
    mode === "therapist" ? `/my/plans/${programId}/${cycle}` : `/programs/${programId}/cycles/${cycle}`;

  if (!data) return <div className="p-8 text-center text-gray-400">جارٍ التحميل...</div>;

  return (
    <div className="space-y-6">
      {mode === "manager" && (
        <section className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
            <Inbox className="size-5 text-cyan-600" />بانتظار المراجعة
            <span className="text-sm font-normal text-gray-400">({data.reviews.length})</span>
          </h2>
          {data.reviews.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">لا يوجد ما ينتظر المراجعة.</p>
          ) : (
            <ul className="divide-y divide-gray-300/70">
              {data.reviews.map((r) => (
                <li key={`${r.doc}${r.programId}${r.cycle}`}>
                  <Link href={href(r.programId, r.cycle)} className="flex flex-wrap items-center gap-3 py-3 hover:bg-gray-50/70">
                    <Badge variant={r.doc === "plan" ? "default" : "info"}>{r.doc === "plan" ? "خطة علاجية" : "تقرير متابعة"}</Badge>
                    <span className="font-medium text-gray-800">{r.patientName}</span>
                    <span className="text-xs text-gray-500">{monthAr(r.cycle)} · {r.therapistName}</span>
                    {r.submittedAt && <span className="text-xs text-gray-400">أُرسل {day(r.submittedAt)}</span>}
                    <span className="ms-auto text-xs font-medium text-primary-600">مراجعة</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-800">
          {mode === "therapist" ? <ClipboardCheck className="size-5 text-primary-600" /> : <FileClock className="size-5 text-amber-600" />}
          {mode === "therapist" ? "المطلوب منك" : "مطلوب من الأخصائيين"}
          <span className="text-sm font-normal text-gray-400">({data.tasks.length})</span>
        </h2>
        {data.tasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">لا توجد خطط أو تقارير مطلوبة الآن.</p>
        ) : (
          <ul className="divide-y divide-gray-300/70">
            {data.tasks.map((t) => (
              <li key={`${t.kind}${t.programId}${t.cycle}`}>
                <Link href={href(t.programId, t.cycle)} className="flex flex-wrap items-center gap-3 py-3 hover:bg-gray-50/70">
                  <span className="font-medium text-gray-800">{t.patientName}</span>
                  <span className="text-xs text-gray-500">
                    {t.serviceName} · {monthAr(t.cycle)}
                    {mode === "manager" && ` · ${t.therapistName}`}
                    {t.firstDate && ` · ${day(t.firstDate)} – ${day(t.lastDate)}`}
                  </span>
                  <span className="ms-auto flex items-center gap-2">
                    {t.late && t.kind.startsWith("PLAN") && <Badge variant="danger">متأخرة</Badge>}
                    <Badge variant={t.kind.endsWith("RETURNED") ? "danger" : t.kind.startsWith("REPORT") ? "warning" : "default"}>{TASK[t.kind]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
