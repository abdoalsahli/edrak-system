"use client";

import { useState } from "react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { Copy, Plus, Trash2, Pencil, Send, Save } from "lucide-react";
import { readApiError } from "@/lib/apiError";
import { FOCUS_AREAS, monthAr } from "@/lib/casePlans/options";
import { ChoiceChecks, Field, Answer } from "./ChoiceFields";
import { DocHeader, ReviewNote, ReviewBar } from "./ReviewBar";
import type { CycleDetail, PlanDraft } from "./types";

const today = () => format(new Date(), "yyyy-MM-dd");
const dayOf = (iso: string) => iso.slice(0, 10);

/** الخطة العلاجية of a cycle — the plan form while it can change, the plan itself after. */
export function PlanSection({ detail, url, onSaved }: { detail: CycleDetail; url: string; onSaved: () => void }) {
  const { plan, canEditPlan } = detail;
  const [editing, setEditing] = useState(!plan && canEditPlan);

  if (editing) {
    return <PlanForm detail={detail} url={url} onDone={() => { setEditing(false); onSaved(); }} onCancel={plan ? () => setEditing(false) : undefined} />;
  }

  return (
    <section className="card p-6 print:shadow-none">
      <DocHeader
        title="الخطة العلاجية"
        doc={plan}
        action={
          canEditPlan && plan ? (
            <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-sm print:hidden">
              <Pencil className="size-4" />تعديل الخطة
            </button>
          ) : null
        }
      />
      {!plan ? (
        <p className="py-6 text-center text-sm text-gray-400">لم تُكتب خطة لهذا الشهر.</p>
      ) : (
        <>
          <ReviewNote doc={plan} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Answer label="تاريخ الخطة">{format(new Date(plan.planDate), "d MMMM yyyy", { locale: arSA })}</Answer>
            <Answer label="الجوانب النمائية التي سيُركَّز عليها">{plan.focusAreas.join("، ")}</Answer>
            <div className="sm:col-span-2"><Answer label="ملخص الحالة">{plan.caseSummary}</Answer></div>
            <div className="sm:col-span-2"><Answer label="الأهداف طويلة المدى">{plan.longTermGoals}</Answer></div>
            <div className="sm:col-span-2">
              <Answer label="الأهداف قصيرة المدى">
                <ol className="list-decimal space-y-1 pr-5">
                  {plan.goals.map((g) => <li key={g.id}>{g.text}</li>)}
                </ol>
              </Answer>
            </div>
            <div className="sm:col-span-2"><Answer label="الأساليب والاستراتيجيات المستخدمة">{plan.methods}</Answer></div>
            {plan.notes && <div className="sm:col-span-2"><Answer label="ملاحظات إضافية">{plan.notes}</Answer></div>}
          </div>
          {detail.canReview && plan.status === "SUBMITTED" && <ReviewBar url={url} doc="plan" onDone={onSaved} />}
        </>
      )}
    </section>
  );
}

function PlanForm({ detail, url, onDone, onCancel }: { detail: CycleDetail; url: string; onDone: () => void; onCancel?: () => void }) {
  const { plan, previous } = detail;
  const [planDate, setPlanDate] = useState(plan ? dayOf(plan.planDate) : today());
  const [caseSummary, setCaseSummary] = useState(plan?.caseSummary ?? "");
  const [longTermGoals, setLongTermGoals] = useState(plan?.longTermGoals ?? "");
  const [goals, setGoals] = useState<string[]>(plan?.goals.length ? plan.goals.map((g) => g.text) : [""]);
  const [methods, setMethods] = useState(plan?.methods ?? "");
  const [focusAreas, setFocusAreas] = useState<string[]>(plan?.focusAreas ?? []);
  const [notes, setNotes] = useState(plan?.notes ?? "");
  // Remount the choice fields when a copy replaces their value
  const [copyKey, setCopyKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function copyPrevious(p: PlanDraft) {
    setCaseSummary(p.caseSummary);
    setLongTermGoals(p.longTermGoals);
    setGoals(p.goals.length ? [...p.goals] : [""]);
    setMethods(p.methods);
    setFocusAreas([...p.focusAreas]);
    setNotes(p.notes ?? "");
    setCopyKey((k) => k + 1);
  }

  async function save(submit: boolean) {
    setSaving(true); setError("");
    const res = await fetch(`${url}/plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planDate, caseSummary, longTermGoals, methods, focusAreas, notes: notes || null, goals, submit }),
    });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    onDone();
  }

  return (
    <section className="card p-6">
      <DocHeader title={plan ? "تعديل الخطة العلاجية" : "كتابة الخطة العلاجية"} doc={plan} />
      {plan && <ReviewNote doc={plan} />}

      {previous && (
        <div className="mb-5 rounded-2xl border border-primary-100 bg-primary-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              يمكنك البدء من خطة {monthAr(previous.cycleNumber)} ثم تعديلها وإضافة أهداف جديدة.
            </p>
            <button type="button" onClick={() => copyPrevious(previous.plan)} className="btn-secondary text-sm">
              <Copy className="size-4" />نسخ خطة {monthAr(previous.cycleNumber)}
            </button>
          </div>
          {previous.recommendations && (
            <div className="mt-3 border-t border-primary-100 pt-3">
              <p className="text-xs font-medium text-primary-700">توصيات تقرير {monthAr(previous.cycleNumber)}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{previous.recommendations}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="تاريخ الخطة" required>
          <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="input" />
        </Field>
        <div />
        <div className="sm:col-span-2">
          <Field label="ملخص الحالة" required hint="فقرة وصفية حسب التقرير الذي لديك">
            <textarea value={caseSummary} onChange={(e) => setCaseSummary(e.target.value)} rows={4} className="input h-auto py-2" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="الأهداف طويلة المدى" required>
            <textarea value={longTermGoals} onChange={(e) => setLongTermGoals(e.target.value)} rows={3} className="input h-auto py-2" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="الأهداف قصيرة المدى" required hint="هدف في كل سطر — تُقيَّم الأهداف واحداً واحداً في تقرير المتابعة">
            <div className="space-y-2">
              {goals.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-sm font-medium text-gray-400">{i + 1}</span>
                  <input
                    value={g}
                    onChange={(e) => setGoals(goals.map((x, k) => (k === i ? e.target.value : x)))}
                    className="input"
                    placeholder="مثال: أن يسمّي الطفل 10 صور مألوفة"
                  />
                  <button
                    type="button"
                    onClick={() => setGoals(goals.length > 1 ? goals.filter((_, k) => k !== i) : [""])}
                    className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="حذف الهدف"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setGoals([...goals, ""])} className="text-sm font-medium text-primary-600 hover:underline">
                <Plus className="inline size-4" /> إضافة هدف
              </button>
            </div>
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="الأساليب والاستراتيجيات المستخدمة" required>
            <textarea value={methods} onChange={(e) => setMethods(e.target.value)} rows={3} className="input h-auto py-2" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="الجوانب النمائية التي ستركز عليها هذا الشهر" required>
            <ChoiceChecks key={copyKey} options={FOCUS_AREAS} value={focusAreas} onChange={setFocusAreas} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="ملاحظات إضافية" hint="إذا أردت إضافة أي شيء">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input h-auto py-2" />
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
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary">إلغاء</button>}
      </div>
    </section>
  );
}
