"use client";

import { useState } from "react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { Pencil, Send, Save, FilePlus2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { readApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import {
  PROGRESS_LEVELS, CHANGES, PARENT_COMMITMENT, OBSTACLES, GOAL_ACHIEVEMENT, choiceLabel, sessionsAr,
} from "@/lib/casePlans/options";
import { ChoiceRadio, ChoiceChecks, Field, Answer } from "./ChoiceFields";
import { DocHeader, ReviewNote, ReviewBar } from "./ReviewBar";
import type { CycleDetail, PlanGoal } from "./types";

type Achievement = PlanGoal["achievement"];

/** Attendance of the cycle, counted from its sessions. */
export function Attendance({ s }: { s: CycleDetail["cycle"]["sessions"] }) {
  const items = [
    { label: "حضر", n: s.completed, cls: "text-green-600" },
    { label: "غاب", n: s.absent, cls: "text-red-600" },
    { label: "أُلغيت", n: s.cancelled, cls: "text-gray-500" },
    { label: "مجدولة", n: s.pending, cls: "text-primary-600" },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
      {items.map((i) => (
        <span key={i.label} className="text-gray-500">
          {i.label} <b className={i.cls}>{i.n}</b>
        </span>
      ))}
    </div>
  );
}

/** تقرير المتابعة — written at the end of the cycle, against the cycle's plan. */
export function ReportSection({ detail, url, onSaved }: { detail: CycleDetail; url: string; onSaved: () => void }) {
  const { plan, report, cycle, canEditReport } = detail;
  const [editing, setEditing] = useState(false);

  if (editing && plan) {
    return <ReportForm detail={detail} url={url} onDone={() => { setEditing(false); onSaved(); }} onCancel={() => setEditing(false)} />;
  }

  const waitingNote = !plan
    ? "يُكتب التقرير بعد كتابة خطة الشهر."
    : plan.status === "DRAFT"
    ? "يُكتب التقرير بعد إرسال الخطة للإدارة."
    : !cycle.ended
    ? `يُرسل التقرير بعد آخر جلسة في الشهر — بقي ${sessionsAr(cycle.sessions.pending)} مجدولة.`
    : null;

  return (
    <section className="card p-6 print:break-before-page print:shadow-none">
      <DocHeader
        title="تقرير المتابعة"
        doc={report}
        action={
          canEditReport ? (
            <button type="button" onClick={() => setEditing(true)} className={cn(report ? "btn-secondary" : "btn-primary", "text-sm print:hidden")}>
              {report ? <><Pencil className="size-4" />تعديل التقرير</> : <><FilePlus2 className="size-4" />كتابة التقرير</>}
            </button>
          ) : null
        }
      />
      {!report ? (
        <p className="py-6 text-center text-sm text-gray-400">
          {waitingNote ?? (cycle.reportExpected ? "انتهى الشهر — التقرير مطلوب الآن." : "لا يوجد تقرير لهذا الشهر.")}
          {waitingNote && plan && plan.status !== "DRAFT" && <><br />يمكنك البدء بمسودة الآن.</>}
        </p>
      ) : (
        <>
          <ReviewNote doc={report} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Answer label="تاريخ التقرير">{format(new Date(report.reportDate), "d MMMM yyyy", { locale: arSA })}</Answer>
            <Answer label="الحضور في الشهر"><Attendance s={cycle.sessions} /></Answer>
            <div className="sm:col-span-2"><Answer label="التشخيص">{report.diagnosis}</Answer></div>
            <div className="sm:col-span-2">
              <Answer label="أهداف الشهر">
                <ul className="space-y-1.5">
                  {plan?.goals.map((g) => (
                    <li key={g.id} className="flex items-start justify-between gap-3">
                      <span>{g.text}</span>
                      {g.achievement && <Badge variant={GOAL_ACHIEVEMENT[g.achievement].variant}>{GOAL_ACHIEVEMENT[g.achievement].label}</Badge>}
                    </li>
                  ))}
                </ul>
              </Answer>
            </div>
            <Answer label="مستوى التقدّم">{choiceLabel(PROGRESS_LEVELS, report.progressLevel)}</Answer>
            <Answer label="التغيرات الملحوظة">{report.changes.join("، ")}</Answer>
            <Answer label="تنفيذ الأهل للتعليمات والمتابعة">{choiceLabel(PARENT_COMMITMENT, report.parentCommitment)}</Answer>
            <Answer label="معوّقات التقدّم">{report.obstacles.join("، ")}</Answer>
            <div className="sm:col-span-2"><Answer label="التوصيات للشهر الجديد">{report.recommendations}</Answer></div>
          </div>
          {detail.canReview && report.status === "SUBMITTED" && <ReviewBar url={url} doc="report" onDone={onSaved} />}
        </>
      )}
    </section>
  );
}

function ReportForm({ detail, url, onDone, onCancel }: { detail: CycleDetail; url: string; onDone: () => void; onCancel: () => void }) {
  const { plan, report, previous, cycle } = detail;
  const [reportDate, setReportDate] = useState(report ? report.reportDate.slice(0, 10) : format(new Date(), "yyyy-MM-dd"));
  const [diagnosis, setDiagnosis] = useState(report?.diagnosis ?? previous?.diagnosis ?? "");
  const [results, setResults] = useState<Record<string, Achievement>>(
    Object.fromEntries((plan?.goals ?? []).map((g) => [g.id, g.achievement])),
  );
  const [progressLevel, setProgressLevel] = useState(report?.progressLevel ?? "");
  const [changes, setChanges] = useState<string[]>(report?.changes ?? []);
  const [parentCommitment, setParentCommitment] = useState(report?.parentCommitment ?? "");
  const [obstacles, setObstacles] = useState<string[]>(report?.obstacles ?? []);
  const [recommendations, setRecommendations] = useState(report?.recommendations ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(submit: boolean) {
    setSaving(true); setError("");
    const res = await fetch(`${url}/report`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportDate, diagnosis, progressLevel, changes, parentCommitment, obstacles, recommendations, submit,
        goalResults: Object.entries(results).map(([goalId, achievement]) => ({ goalId, achievement })),
      }),
    });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    onDone();
  }

  return (
    <section className="card p-6">
      <DocHeader title={report ? "تعديل تقرير المتابعة" : "كتابة تقرير المتابعة"} doc={report} />
      {report && <ReviewNote doc={report} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="تاريخ التقرير" required>
          <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="input" />
        </Field>
        <Field label="الحضور في الشهر" hint="محسوب من الجلسات">
          <div className="flex min-h-[2.75rem] items-center"><Attendance s={cycle.sessions} /></div>
        </Field>
        <div className="sm:col-span-2">
          <Field label="التشخيص" required>
            <textarea value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} rows={2} className="input" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="أهداف الشهر" required hint="أهداف الخطة — حدّد ما تحقق من كل هدف">
            <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-300">
              {plan?.goals.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-sm text-gray-800">{g.text}</span>
                  <div className="flex gap-1">
                    {(Object.keys(GOAL_ACHIEVEMENT) as NonNullable<Achievement>[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setResults({ ...results, [g.id]: results[g.id] === a ? null : a })}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition",
                          results[g.id] === a
                            ? a === "ACHIEVED" ? "border-green-600 bg-green-50 text-green-700"
                              : a === "PARTIAL" ? "border-amber-500 bg-amber-50 text-amber-700"
                              : "border-red-500 bg-red-50 text-red-700"
                            : "border-gray-300 text-gray-500 hover:border-gray-400",
                        )}
                      >
                        {GOAL_ACHIEVEMENT[a].label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="مستوى التقدّم" required>
            <ChoiceRadio name="progress" options={PROGRESS_LEVELS} value={progressLevel} onChange={setProgressLevel} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="التغيرات الملحوظة" required>
            <ChoiceChecks options={CHANGES} value={changes} onChange={setChanges} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="تنفيذ الأهل للتعليمات والمتابعة" required>
            <ChoiceRadio name="parents" options={PARENT_COMMITMENT} value={parentCommitment} onChange={setParentCommitment} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="معوّقات التقدّم (إن وُجدت)" required>
            <ChoiceChecks options={OBSTACLES} value={obstacles} onChange={setObstacles} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="التوصيات للشهر الجديد" required hint="تظهر للأخصائي عند كتابة خطة الشهر التالي">
            <textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={4} className="input" />
          </Field>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => save(true)} className="btn-primary">
          <Send className="size-4" />{saving ? "جارٍ الحفظ..." : "إرسال للإدارة"}
        </button>
        <button type="button" disabled={saving} onClick={() => save(false)} className="btn-secondary">
          <Save className="size-4" />حفظ كمسودة
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">إلغاء</button>
      </div>
    </section>
  );
}
