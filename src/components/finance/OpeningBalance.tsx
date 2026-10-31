"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { readApiError } from "@/lib/apiError";

/**
 * الرصيد الافتتاحي — what a patient or a therapist owed before the system
 * started. Entered as an amount and a side, saved in the account's direction:
 * patient → positive = owes the centre; therapist → positive = owed by the centre.
 */

type Who = "patient" | "therapist";

const SIDES: Record<Who, { plus: string; minus: string }> = {
  patient: { plus: "مستحق عليها", minus: "لصالحها (دفعت مقدماً)" },
  therapist: { plus: "مستحق له", minus: "عليه (سلفة)" },
};

export type OpeningValue = { amount: number | ""; side: "plus" | "minus"; date: string };

export const emptyOpening = (): OpeningValue => ({ amount: "", side: "plus", date: format(new Date(), "yyyy-MM-dd") });

/** The body the APIs expect, or null when nothing was entered. */
export function toOpeningPayload(v: OpeningValue) {
  const n = Number(v.amount) || 0;
  if (n === 0) return null;
  return { amount: v.side === "plus" ? Math.abs(n) : -Math.abs(n), date: v.date || null };
}

const money = (n: number) => `${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل`;

/** The fields themselves: amount, side and date. */
export function OpeningBalanceInput({ who, value, onChange }: { who: Who; value: OpeningValue; onChange: (v: OpeningValue) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div>
        <label className="label">المبلغ (د.ل)</label>
        <input
          type="number" min={0} step="0.01" value={value.amount} placeholder="0"
          onChange={(e) => onChange({ ...value, amount: e.target.value === "" ? "" : Math.abs(parseFloat(e.target.value)) })}
          className="input" dir="ltr"
        />
      </div>
      <div>
        <label className="label">الاتجاه</label>
        <select value={value.side} onChange={(e) => onChange({ ...value, side: e.target.value as "plus" | "minus" })} className="input">
          <option value="plus">{SIDES[who].plus}</option>
          <option value="minus">{SIDES[who].minus}</option>
        </select>
      </div>
      <div>
        <label className="label">بتاريخ</label>
        <input type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} className="input" dir="ltr" />
      </div>
    </div>
  );
}

/** A form section for creating a patient or a therapist with a balance carried over. */
export function OpeningBalanceSection({ who, value, onChange }: { who: Who; value: OpeningValue; onChange: (v: OpeningValue) => void }) {
  return (
    <div className="card p-5">
      <h2 className="font-semibold text-gray-900">الرصيد الافتتاحي</h2>
      <p className="mb-4 mt-1 text-xs text-gray-500">
        {who === "patient"
          ? "ما على الحالة أو لها من قبل بدء العمل بالنظام: قيمة الجلسات التي عُقدت ناقص ما دفعته. اتركه فارغاً إن لم يكن هناك رصيد."
          : "ما يستحقه الأخصائي من قبل بدء العمل بالنظام ولم يُصرف له، أو سلفة عليه. اتركه فارغاً إن لم يكن هناك رصيد."}
      </p>
      <OpeningBalanceInput who={who} value={value} onChange={onChange} />
    </div>
  );
}

/**
 * The opening balance of an existing patient or therapist, with an edit form.
 * A change posts only the difference («تعديل الرصيد الافتتاحي»). Renders
 * nothing for those who may not see money.
 */
export function OpeningBalanceCard({ patientId, therapistId }: { patientId?: string; therapistId?: string }) {
  const router = useRouter();
  const who: Who = patientId ? "patient" : "therapist";
  const query = patientId ? `patientId=${patientId}` : `therapistId=${therapistId}`;
  const [current, setCurrent] = useState<{ amount: number; date: string | null } | null | "hidden">(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<OpeningValue>(emptyOpening());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/opening-balances?${query}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCurrent(d ?? "hidden"));
  }, [query]);

  if (current === "hidden") return null;

  function startEdit() {
    if (!current || current === "hidden") return;
    setValue({
      amount: current.amount ? Math.abs(current.amount) : "",
      side: current.amount < 0 ? "minus" : "plus",
      date: current.date ? current.date.slice(0, 10) : format(new Date(), "yyyy-MM-dd"),
    });
    setError("");
    setEditing(true);
  }

  async function save() {
    setSaving(true); setError("");
    const p = toOpeningPayload(value);
    const res = await fetch("/api/opening-balances", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientId, therapistId, amount: p?.amount ?? 0, date: value.date || null }),
    });
    setSaving(false);
    if (!res.ok) { setError(await readApiError(res)); return; }
    setCurrent(await res.json());
    setEditing(false);
    // Balances shown elsewhere on the page come from the server
    router.refresh();
  }

  const amount = current ? current.amount : 0;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-gray-900">الرصيد الافتتاحي</h2>
          {!editing && (
            <p className="mt-1 text-sm text-gray-600">
              {current === null ? "…"
                : amount === 0 ? "لا يوجد"
                : <>
                    <b className={amount > 0 === (who === "patient") ? "text-red-600" : "text-green-600"}>{money(amount)}</b>{" "}
                    {amount > 0 ? SIDES[who].plus : SIDES[who].minus}
                    {current.date && <span className="text-xs text-gray-400"> — بتاريخ {format(new Date(current.date), "d MMMM yyyy", { locale: arSA })}</span>}
                  </>}
            </p>
          )}
        </div>
        {!editing && current !== null && (
          <button type="button" onClick={startEdit} className="btn-secondary text-sm">
            <Pencil className="size-4" />{amount === 0 ? "إدخال" : "تعديل"}
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-4 space-y-3">
          <OpeningBalanceInput who={who} value={value} onChange={setValue} />
          <p className="text-xs text-gray-400">
            يُسجَّل في كشف الحساب كقيد «رصيد افتتاحي»، وأي تعديل لاحق يُسجَّل بالفرق فقط. التاريخ يُستعمل عند الإدخال الأول.
          </p>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={saving} onClick={save} className="btn-primary text-sm">{saving ? "جارٍ الحفظ..." : "حفظ"}</button>
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-sm">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}
