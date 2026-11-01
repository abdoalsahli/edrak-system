"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { ChevronRight, ChevronLeft, Printer } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { readApiError } from "@/lib/apiError";
import { to12 } from "@/lib/time12";
import { monthAr } from "@/lib/casePlans/options";
import { PlanSection } from "./PlanSection";
import { ReportSection, Attendance } from "./ReportSection";
import type { CycleDetail } from "./types";

const SESSION_STATUS: Record<string, { label: string; variant: "success" | "danger" | "gray" | "default" }> = {
  PENDING: { label: "مجدولة", variant: "default" },
  COMPLETED: { label: "حضر", variant: "success" },
  ABSENT: { label: "غياب", variant: "danger" },
  CANCELLED_BY_PATIENT: { label: "ألغت الحالة", variant: "gray" },
  CANCELLED_BY_CENTER: { label: "ألغى المركز", variant: "gray" },
};

const day = (iso: string | null) => (iso ? format(new Date(iso), "d MMM yyyy", { locale: arSA }) : "—");

/**
 * One cycle of a program: its treatment plan, its follow-up report, the
 * manager's review, and the sessions it covers. `basePath` is the cycles route
 * of the viewer (the therapist portal or the program page).
 */
export function CycleWorkspace({ programId, cycle, basePath, backHref }: {
  programId: string;
  cycle: number;
  basePath: string;
  backHref: string;
}) {
  const url = `/api/case-plans/${programId}/${cycle}`;
  const [detail, setDetail] = useState<CycleDetail | null>(null);
  const [error, setError] = useState("");
  // Remount the sections after a save so each opens in its read view
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(url);
    if (!res.ok) { setError(await readApiError(res, "تعذّر تحميل الشهر")); return; }
    setDetail(await res.json());
    setVersion((v) => v + 1);
  }, [url]);
  useEffect(() => { load(); }, [load]);

  if (!detail) {
    return error
      ? <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      : <div className="p-8 text-center text-gray-400">جارٍ التحميل...</div>;
  }

  const { program, cycle: c } = detail;
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={`${program.patient.fullName} — ${monthAr(c.number)}`}
        description={`${program.service.name} · الأخصائي ${program.therapist.fullName}`}
        action={
          <div className="flex items-center gap-2 print:hidden">
            {c.number > 1 && (
              <Link href={`${basePath}/${c.number - 1}`} className="btn-secondary px-3" title="الشهر السابق"><ChevronRight className="size-4" /></Link>
            )}
            {c.number < detail.cycleCount && (
              <Link href={`${basePath}/${c.number + 1}`} className="btn-secondary px-3" title="الشهر التالي"><ChevronLeft className="size-4" /></Link>
            )}
            <button type="button" onClick={() => window.print()} className="btn-secondary text-sm"><Printer className="size-4" />طباعة</button>
          </div>
        }
      />

      {/* The cycle at a glance */}
      <div className="card mb-6 grid gap-4 p-5 text-sm sm:grid-cols-3 print:shadow-none">
        <div>
          <p className="text-gray-500">جلسات الشهر</p>
          <p className="mt-1 font-medium text-gray-800">من {c.fromSequence} إلى {c.toSequence}</p>
        </div>
        <div>
          <p className="text-gray-500">الفترة</p>
          <p className="mt-1 font-medium text-gray-800">
            {c.sessions.total ? `${day(c.firstDate)} — ${day(c.lastDate)}` : "لم تُجدول جلساتها بعد (يُمدَّد البرنامج)"}
          </p>
        </div>
        <div>
          <p className="text-gray-500 mb-1">الحضور</p>
          <Attendance s={c.sessions} />
        </div>
      </div>

      <div className="space-y-6">
        <PlanSection key={`p${version}`} detail={detail} url={url} onSaved={load} />
        <ReportSection key={`r${version}`} detail={detail} url={url} onSaved={load} />

        {detail.sessions.length > 0 && (
          <details className="card p-6 print:hidden">
            <summary className="cursor-pointer text-lg font-semibold text-gray-800">جلسات الشهر ({detail.sessions.length})</summary>
            <ul className="mt-4 divide-y divide-gray-200 text-sm">
              {detail.sessions.map((s) => {
                const st = SESSION_STATUS[s.status] ?? { label: s.status, variant: "gray" as const };
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="w-6 font-medium text-gray-400">{s.sequence}</span>
                    <span className="w-36 text-gray-700">{day(s.date)}</span>
                    <span className="w-20 text-gray-500">{s.startTime ? to12(s.startTime) : ""}</span>
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {s.notes && <span className="text-xs text-gray-500">{s.notes}</span>}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
