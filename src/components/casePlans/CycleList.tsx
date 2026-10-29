"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { DOC_STATUS, sessionsAr } from "@/lib/casePlans/options";
import type { CycleSummary } from "./types";

const day = (iso: string | null) => (iso ? format(new Date(iso), "d MMM", { locale: arSA }) : "");

/** What the plan column says when a cycle has no plan yet. */
function missingPlan(c: CycleSummary) {
  if (c.ended) return { label: "بدون خطة", variant: "gray" as const };
  return { label: c.started ? "الخطة متأخرة" : "الخطة مطلوبة", variant: c.started ? ("danger" as const) : ("warning" as const) };
}

function reportState(c: CycleSummary) {
  if (c.report) return DOC_STATUS[c.report.status];
  if (c.reportExpected && c.plan) return { label: "التقرير مطلوب", variant: "danger" as const };
  if (!c.ended && c.sessions.total) return { label: `بقي ${sessionsAr(c.sessions.pending)}`, variant: "gray" as const };
  return null;
}

/**
 * «الخطط والتقارير» of a program, as a card: one row per cycle with the state
 * of its plan and report. `basePath` + `/<cycle>` opens the cycle. Renders
 * nothing for a viewer who may not see plans (reception, accounts).
 */
export function CycleList({ programId, basePath, title = "الخطط العلاجية وتقارير المتابعة" }: {
  programId: string;
  basePath: string;
  title?: React.ReactNode;
}) {
  const [cycles, setCycles] = useState<CycleSummary[] | null | "hidden">(null);

  useEffect(() => {
    fetch(`/api/case-plans/${programId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCycles(d ? d.cycles : "hidden"));
  }, [programId]);

  if (cycles === "hidden") return null;
  return (
    <section className="card p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">{title}</h2>
      {!cycles ? (
        <p className="py-4 text-center text-sm text-gray-400">جارٍ التحميل...</p>
      ) : cycles.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">لا توجد جلسات في هذا البرنامج بعد.</p>
      ) : (
        <CycleRows cycles={cycles} basePath={basePath} />
      )}
    </section>
  );
}

function CycleRows({ cycles, basePath }: { cycles: CycleSummary[]; basePath: string }) {
  // A running cycle without an approved plan: sessions go ahead, but flag it
  const running = cycles.find((c) => c.started && !c.ended);
  const warn = running && running.plan?.status !== "APPROVED";

  return (
    <div>
      {warn && (
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          الدورة {running.number} بدأت {running.plan ? "وخطتها لم تُعتمد بعد" : "بدون خطة علاجية"} — الجلسات تُعدّ بناءً على الخطة.
        </div>
      )}
      <ul className="divide-y divide-gray-300/70">
        {cycles.map((c) => {
          const plan = c.plan ? DOC_STATUS[c.plan.status] : missingPlan(c);
          const report = reportState(c);
          return (
            <li key={c.number}>
              <Link href={`${basePath}/${c.number}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 hover:bg-gray-50/70">
                <span className="w-20 font-medium text-gray-800">الدورة {c.number}</span>
                <span className="w-44 text-xs text-gray-500">
                  جلسات {c.fromSequence}–{c.toSequence}
                  {c.firstDate && ` · ${day(c.firstDate)} – ${day(c.lastDate)}`}
                  {!c.sessions.total && " · قادمة"}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500">الخطة <Badge variant={plan.variant}>{plan.label}</Badge></span>
                {report && <span className="flex items-center gap-1.5 text-xs text-gray-500">التقرير <Badge variant={report.variant}>{report.label}</Badge></span>}
                <span className="ms-auto text-xs font-medium text-primary-600">فتح</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
