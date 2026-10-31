"use client";

import { useState, useEffect, useMemo } from "react";
import { readApiError } from "@/lib/apiError";
import { Modal } from "@/components/ui/Modal";
import { PaymentMethodField } from "@/components/finance/PaymentMethodField";
import { AccountSelect, type AccountOption } from "@/components/finance/AccountSelect";
import { SettlementFields, type SettlementValue } from "@/components/finance/SettlementFields";

/**
 * One voucher form used everywhere: سند قبض · سند صرف · تسوية.
 * Opened from the finance dashboard and document lists (pick any account),
 * or from an account statement (the account is fixed).
 */

export type VoucherKind = "receipt" | "payment" | "settlement";
type Kind = AccountOption["kind"];
export type { AccountOption };

const TITLE: Record<VoucherKind, string> = { receipt: "سند قبض", payment: "سند صرف", settlement: "تسوية" };

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

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
  // settlement — worked out by SettlementFields from the chosen template
  const [stl, setStl] = useState<SettlementValue | null>(null);
  // Remounts the settlement fields on every opening, so they start fresh
  const [openCount, setOpenCount] = useState(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset and load every time it opens
  useEffect(() => {
    if (!open) return;
    setError(""); setAmount(""); setReference(""); setDate(today());
    setAccountId(fixedAccount?.id ?? "");
    setStl(null); setOpenCount((n) => n + 1);
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
      : account.kind === "PATIENT" ? `استرداد للحالة — ${account.name}`
      : account.kind === "EXPENSE" ? account.name
      : `صرف — ${account.name}`
    );
  }, [kind, account, description]);

  const [autoDescription, setAutoDescription] = useState("");
  useEffect(() => {
    if (kind !== "settlement" || !stl) return;
    if (!description || description === autoDescription) setDescription(stl.description);
    setAutoDescription(stl.description);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, stl?.description]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind !== "settlement" && !method) { setError("اختر طريقة الدفع"); return; }
    if (kind === "settlement" && stl?.error) { setError(stl.error); return; }
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
      res = await fetch("/api/finance/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: stl?.type, amount: Number(amount), date, description,
          debitAccountId: stl?.debitAccountId, creditAccountId: stl?.creditAccountId,
        }),
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
          <SettlementFields key={openCount} accounts={accounts} fixedAccount={fixedAccount}
            amount={Number(amount) || 0} onChange={setStl} />
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
