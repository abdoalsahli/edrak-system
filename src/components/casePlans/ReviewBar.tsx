"use client";

import { useState } from "react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { CheckCircle2, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { readApiError } from "@/lib/apiError";
import { DOC_STATUS } from "@/lib/casePlans/options";
import type { Review } from "./types";

const when = (iso: string) => format(new Date(iso), "d MMMM yyyy", { locale: arSA });

/** Section title with the document's status and who reviewed it. */
export function DocHeader({ title, doc, action }: { title: string; doc: Review | null; action?: React.ReactNode }) {
  const st = doc ? DOC_STATUS[doc.status] : null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        {st && <Badge variant={st.variant}>{st.label}</Badge>}
        {doc?.status === "APPROVED" && doc.reviewedBy && doc.reviewedAt && (
          <span className="text-xs text-gray-400">اعتمده {doc.reviewedBy.name} — {when(doc.reviewedAt)}</span>
        )}
        {doc?.status === "SUBMITTED" && doc.submittedAt && (
          <span className="text-xs text-gray-400">أُرسل {when(doc.submittedAt)}</span>
        )}
      </div>
      {action}
    </div>
  );
}

/** Management's note on a document sent back for changes. */
export function ReviewNote({ doc }: { doc: Review }) {
  if (doc.status !== "RETURNED" || !doc.reviewNote) return null;
  return (
    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 print:hidden">
      <p className="text-xs font-medium text-red-700">
        ملاحظة الإدارة{doc.reviewedBy ? ` (${doc.reviewedBy.name})` : ""} — المطلوب تعديله:
      </p>
      <p className="mt-1 whitespace-pre-line text-sm text-red-800">{doc.reviewNote}</p>
    </div>
  );
}

/** The manager's decision on a sent plan or report: approve, or return with a note. */
export function ReviewBar({ url, doc, onDone }: { url: string; doc: "plan" | "report"; onDone: () => void }) {
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const what = doc === "plan" ? "الخطة" : "التقرير";

  async function decide(decision: "APPROVE" | "RETURN") {
    setSaving(true); setError("");
    const res = await fetch(`${url}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doc, decision, note: note || null }),
    });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    setReturning(false); setNote("");
    onDone();
  }

  return (
    <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 print:hidden">
      <p className="mb-3 text-sm font-medium text-gray-700">مراجعة الإدارة: {what} بانتظار قرارك.</p>
      {returning ? (
        <div className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="input"
            placeholder={`ما المطلوب تعديله في ${what}؟`}
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={() => decide("RETURN")} className="btn-danger">
              <Undo2 className="size-4" />إرجاع للأخصائي
            </button>
            <button type="button" onClick={() => setReturning(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={saving} onClick={() => decide("APPROVE")} className="btn-primary">
            <CheckCircle2 className="size-4" />اعتماد {what}
          </button>
          <button type="button" onClick={() => setReturning(true)} className="btn-secondary">
            <Undo2 className="size-4" />إرجاع للتعديل
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
