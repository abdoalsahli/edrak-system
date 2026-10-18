"use client";

import { useState, useEffect, useMemo } from "react";
import { readApiError } from "@/lib/apiError";
import { Modal } from "@/components/ui/Modal";
import { PaymentMethodField } from "@/components/finance/PaymentMethodField";

/**
 * One voucher form used everywhere: سند قبض · سند صرف · تسوية.
 * Opened from the finance dashboard and document lists (pick any account),
 * or from an account statement (the account is fixed).
 */

export type VoucherKind = "receipt" | "payment" | "settlement";
type Kind = "PATIENT" | "THERAPIST" | "EXPENSE" | "CUSTOM" | "CASH";
type Nature = "DEBIT" | "CREDIT";

export type AccountOption = { id: string; code: string; name: string; kind: Kind; nature: Nature; balance?: number };

const KIND_GROUP: Record<Kind, string> = {
  PATIENT: "المرضى",
  THERAPIST: "الأخصائيون",
  EXPENSE: "المصروفات",
  CUSTOM: "حسابات عامة",
  CASH: "الصناديق والبنوك",
};
const KIND_ORDER: Kind[] = ["PATIENT", "THERAPIST", "EXPENSE", "CUSTOM", "CASH"];

const SETTLEMENT_TYPES: [string, string][] = [
  ["DISCOUNT", "خصم"],
  ["WRITE_OFF", "إعدام دين"],
  ["CORRECTION", "تصحيح / عجز أو زيادة جرد"],
  ["TRANSFER", "تحويل بين حسابين"],
  ["OTHER", "أخرى"],
];

const TITLE: Record<VoucherKind, string> = { receipt: "سند قبض", payment: "سند صرف", settlement: "تسوية" };
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

/** Searchable account picker, grouped by kind. */
export function AccountSelect({
  accounts, value, onChange, exclude = [], kinds, required, placeholder = "— اختر الحساب —",
}: {
  accounts: AccountOption[];
  value: string;
  onChange: (id: string) => void;
  exclude?: string[];
  kinds?: Kind[];
  required?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const options = accounts.filter(
    (a) =>
      !exclude.includes(a.id) &&
      (!kinds || kinds.includes(a.kind)) &&
      (!q || a.name.includes(q) || a.code.toLowerCase().includes(q.toLowerCase()))
  );
  return (
    <div className="space-y-1">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الرمز..." className="input text-sm" />
      <select required={required} value={value} onChange={(e) => onChange(e.target.value)} className="input">
        <option value="">{placeholder}</option>
        {KIND_ORDER.map((k) => {
          const group = options.filter((a) => a.kind === k);
          if (group.length === 0) return null;
          return (
            <optgroup key={k} label={KIND_GROUP[k]}>
              {group.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

export function VoucherModal({
  open, kind, onClose, onDone, fixedAccount,
}: {
  open: boolean;
  kind: VoucherKind;
  onClose: () => void;
  onDone?: (doc: { voucherNumber?: string }) => void;
  fixedAccount?: AccountOption | null;
}) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(today());
  const [method, setMethod] = useState(""); // payment method id — it decides the box
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  // settlement
  const [stlType, setStlType] = useState("DISCOUNT");
  const [stlSide, setStlSide] = useState<"debit" | "credit">("credit");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset and load every time it opens
  useEffect(() => {
    if (!open) return;
    setError(""); setAmount(""); setReference(""); setDate(today());
    setDebitAccountId(""); setCreditAccountId(""); setStlType("DISCOUNT");
    setAccountId(fixedAccount?.id ?? "");
    setStlSide(fixedAccount?.nature === "CREDIT" ? "debit" : "credit");
    setDescription("");
    fetch("/api/ledger/accounts").then((r) => (r.ok ? r.json() : null)).then((d) => d && setAccounts(d.data));
  }, [open, kind, fixedAccount]);

  const account = useMemo(
    () => fixedAccount ?? accounts.find((a) => a.id === accountId) ?? null,
    [fixedAccount, accounts, accountId]
  );

  // Sensible default wording for a payment voucher once the account is known
  useEffect(() => {
    if (kind !== "payment" || !account || description) return;
    setDescription(
      account.kind === "THERAPIST" ? `صرف لحساب الأخصائي — ${account.name}`
      : account.kind === "PATIENT" ? `استرداد للمريض — ${account.name}`
      : account.kind === "EXPENSE" ? account.name
      : `صرف — ${account.name}`
    );
  }, [kind, account, description]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind !== "settlement" && !method) { setError("اختر طريقة الدفع"); return; }
    setSaving(true); setError("");
    let res: Response;

    if (kind === "receipt") {
      res = await fetch("/api/finance/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account?.id, amount: Number(amount), paymentMethodId: method, paymentDate: date,
          referenceNumber: reference || undefined,
          notes: description || undefined,
        }),
      });
    } else if (kind === "payment") {
      const k = account?.kind;
      const type = k === "THERAPIST" ? "COMMISSION" : k === "PATIENT" ? "REFUND" : k === "EXPENSE" ? "EXPENSE" : "OTHER";
      res = await fetch("/api/finance/disbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account?.id, type, amount: Number(amount), paymentMethodId: method, paymentDate: date,
          description, referenceNumber: reference || undefined, settleCommissions: k === "THERAPIST",
        }),
      });
    } else {
      let debit = debitAccountId || undefined;
      let credit = creditAccountId || undefined;
      if (fixedAccount) {
        // the fixed account takes the chosen side; the picked account (if any) the other
        const other = accountId && accountId !== fixedAccount.id ? accountId : undefined;
        debit = stlSide === "debit" ? fixedAccount.id : other;
        credit = stlSide === "credit" ? fixedAccount.id : other;
      }
      res = await fetch("/api/finance/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: stlType, amount: Number(amount), date, description, debitAccountId: debit, creditAccountId: credit }),
      });
    }

    if (!res.ok) {
      setError(await readApiError(res));
      setSaving(false);
      return;
    }
    const doc = await res.json();
    setSaving(false);
    onClose();
    onDone?.(doc);
  }

  const partyKinds: Kind[] = ["PATIENT", "THERAPIST", "EXPENSE", "CUSTOM"];

  return (
    <Modal open={open} onClose={onClose} title={TITLE[kind]}>
      <form onSubmit={submit} className="space-y-4">
        {/* ── Account(s) ─────────────────────────────────────────── */}
        {kind !== "settlement" && (
          fixedAccount ? (
            <div className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between">
              <span>{fixedAccount.name} <span className="font-mono text-xs text-gray-400" dir="ltr">{fixedAccount.code}</span></span>
              {fixedAccount.balance !== undefined && (
                <span className="text-gray-500">الرصيد: <strong dir="ltr">{money(fixedAccount.balance)}</strong></span>
              )}
            </div>
          ) : (
            <div>
              <label className="label">{kind === "receipt" ? "من حساب" : "إلى حساب"} <span className="text-red-500">*</span></label>
              <AccountSelect accounts={accounts} value={accountId} onChange={setAccountId} kinds={partyKinds} required />
            </div>
          )
        )}

        {kind === "settlement" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">نوع التسوية</label>
                <select value={stlType} onChange={(e) => setStlType(e.target.value)} className="input">
                  {SETTLEMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {fixedAccount && (
                <div>
                  <label className="label">قيد على «{fixedAccount.name}»</label>
                  <select value={stlSide} onChange={(e) => setStlSide(e.target.value as "debit" | "credit")} className="input">
                    <option value="credit">دائن (له)</option>
                    <option value="debit">مدين (عليه)</option>
                  </select>
                </div>
              )}
            </div>

            {fixedAccount ? (
              <div>
                <label className="label">
                  الحساب المقابل {stlType === "TRANSFER" ? <span className="text-red-500">*</span> : <span className="text-xs text-gray-400">(اختياري)</span>}
                </label>
                <AccountSelect accounts={accounts} value={accountId === fixedAccount.id ? "" : accountId} onChange={setAccountId}
                  exclude={[fixedAccount.id]} required={stlType === "TRANSFER"} placeholder="— بدون حساب مقابل —" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">الحساب المدين {stlType === "TRANSFER" && <span className="text-red-500">*</span>}</label>
                  <AccountSelect accounts={accounts} value={debitAccountId} onChange={setDebitAccountId}
                    exclude={creditAccountId ? [creditAccountId] : []} required={stlType === "TRANSFER"} placeholder="—" />
                </div>
                <div>
                  <label className="label">الحساب الدائن {stlType === "TRANSFER" && <span className="text-red-500">*</span>}</label>
                  <AccountSelect accounts={accounts} value={creditAccountId} onChange={setCreditAccountId}
                    exclude={debitAccountId ? [debitAccountId] : []} required={stlType === "TRANSFER"} placeholder="—" />
                </div>
              </div>
            )}
            <p className="text-xs text-gray-400">
              خصم على مريض: الدائن = حساب المريض. إيداع نقد في البنك: تحويل، المدين = البنك والدائن = الصندوق.
              عجز جرد: الدائن = الصندوق.
            </p>
          </div>
        )}

        {/* ── Amount & cash ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">المبلغ <span className="text-red-500">*</span></label>
            <input required type="number" min={0.01} step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))} className="input" dir="ltr" />
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" dir="ltr" />
          </div>

          {kind !== "settlement" && (
            <>
              <PaymentMethodField value={method} onChange={setMethod} direction={kind === "receipt" ? "to" : "from"} />
              <div className="col-span-2">
                <label className="label">رقم المرجع</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} className="input" dir="ltr" placeholder="اختياري" />
              </div>
            </>
          )}

          <div className="col-span-2">
            <label className="label">البيان {kind !== "receipt" && <span className="text-red-500">*</span>}</label>
            <input required={kind !== "receipt"} value={description} onChange={(e) => setDescription(e.target.value)} className="input"
              placeholder={kind === "receipt" ? "اختياري" : ""} />
          </div>
        </div>

        {kind === "payment" && account?.kind === "THERAPIST" && (
          <p className="text-xs text-gray-500">يمكن صرف أي مبلغ — جزئي، أو أكثر من المستحق كسُلفة.</p>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "جارٍ الحفظ..." : kind === "receipt" ? "إصدار سند القبض" : kind === "payment" ? "إصدار سند الصرف" : "ترحيل التسوية"}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}
