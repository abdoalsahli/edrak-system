"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  SETTLEMENT_TEMPLATES, FREE_TYPES, type SettlementTemplate, type SettlementType, type Side, type AccountKind,
} from "@/lib/finance/settlementTemplates";
import { AccountSelect, type AccountOption } from "./AccountSelect";

/** What the settlement form posts, worked out from the chosen template. */
export type SettlementValue = {
  type: SettlementType;
  debitAccountId?: string;
  creditAccountId?: string;
  /** A suggested statement («البيان») for the chosen template and account */
  description: string;
  /** Why it cannot be posted yet, or null */
  error: string | null;
};

const BALANCE_WORD: Record<AccountKind, string> = {
  PATIENT: "المستحق على الحالة",
  THERAPIST: "المستحق للأخصائي",
  EXPENSE: "رصيد المصروف",
  CUSTOM: "رصيد الحساب",
  CASH: "رصيد الصندوق",
};
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What a settlement does to an account, in plain words. «from» is credited, «to» debited. */
function EffectLine({ account, side, amount }: { account: AccountOption | null | undefined; side: Side; amount: number }) {
  if (!account) return null;
  // Debit-natured accounts grow when they receive; credit-natured ones when they give
  const grows = (side === "to") === (account.nature === "DEBIT");
  return (
    <p className={cn("mt-1 text-xs", grows ? "text-amber-700" : "text-green-700")}>
      {grows ? "▲ يزيد" : "▼ ينقص"} {BALANCE_WORD[account.kind]}{amount > 0 ? ` ${money(amount)} د.ل` : ""}
    </p>
  );
}

const flip = (s: Side): Side => (s === "from" ? "to" : "from");

/**
 * The settlement part of the voucher form: pick what happened (a template),
 * then the account(s). The direction comes from the template. Opened from an
 * account statement, only the templates about that account are offered.
 */
export function SettlementFields({ accounts, fixedAccount, amount, onChange }: {
  accounts: AccountOption[];
  fixedAccount?: AccountOption | null;
  amount: number;
  onChange: (v: SettlementValue) => void;
}) {
  const templates = useMemo(
    () => SETTLEMENT_TEMPLATES.filter((t) => !fixedAccount || t.key === "free" || t.main.kinds.includes(fixedAccount.kind)),
    [fixedAccount],
  );
  const [key, setKey] = useState(templates[0].key);
  const [mainId, setMainId] = useState(fixedAccount?.id ?? "");
  const [counterId, setCounterId] = useState("");
  const [freeType, setFreeType] = useState<SettlementType>("OTHER");
  // Free entry from a statement: is that account the «from» or the «to» side?
  const [freeSide, setFreeSide] = useState<Side>(fixedAccount?.nature === "CREDIT" ? "to" : "from");

  const t: SettlementTemplate = templates.find((x) => x.key === key) ?? templates[0];
  const isFree = t.key === "free";
  const side: Side = isFree && fixedAccount ? freeSide : t.main.side;
  const main = accounts.find((a) => a.id === mainId) ?? (fixedAccount?.id === mainId ? fixedAccount : null);
  const counter = accounts.find((a) => a.id === counterId) ?? null;
  const type = isFree ? freeType : t.type;
  const counterRequired = t.counter.required || (isFree && type === "TRANSFER");

  function pick(next: string) {
    setKey(next);
    if (!fixedAccount) setMainId("");
    setCounterId("");
  }

  useEffect(() => {
    const mainSide = side;
    const ids: Record<Side, string | undefined> = { from: undefined, to: undefined };
    if (mainId) ids[mainSide] = mainId;
    if (counterId) ids[flip(mainSide)] = counterId;
    const error =
      isFree && !mainId && !counterId ? "اختر حساباً واحداً على الأقل"
      : !isFree && !mainId ? `اختر ${t.main.label}`
      : counterRequired && (!mainId || !counterId) ? `اختر ${isFree ? "الحسابين" : t.counter.label}`
      : null;
    onChange({
      type,
      debitAccountId: ids.to,
      creditAccountId: ids.from,
      description:
        isFree || !main ? ""
        : t.verb && counter ? `${t.verb} من ${main.name} إلى ${counter.name}`
        : `${t.label} — ${main.name}`,
      error,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mainId, counterId, side, type, main?.name, counter?.name]);

  return (
    <div className="space-y-3">
      <div>
        <label className="label">نوع العملية</label>
        <div className="flex flex-wrap gap-2">
          {templates.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => pick(x.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                x.key === key ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-300 text-gray-600 hover:border-primary-300",
                x.key === "free" && x.key !== key && "border-dashed text-gray-400",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{t.hint}</p>
      </div>

      {isFree && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">التصنيف</label>
            <select value={freeType} onChange={(e) => setFreeType(e.target.value as SettlementType)} className="input">
              {FREE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {fixedAccount && (
            <div>
              <label className="label">«{fixedAccount.name}»</label>
              <select value={freeSide} onChange={(e) => setFreeSide(e.target.value as Side)} className="input">
                <option value="from">من هذا الحساب</option>
                <option value="to">إلى هذا الحساب</option>
              </select>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">
            {isFree && fixedAccount ? (freeSide === "from" ? "من حساب" : "إلى حساب") : t.main.label}
            {!isFree && <span className="text-red-500"> *</span>}
          </label>
          {fixedAccount ? (
            <div className="input flex items-center bg-gray-50">{fixedAccount.name}</div>
          ) : (
            <AccountSelect accounts={accounts} value={mainId} onChange={setMainId} kinds={t.main.kinds}
              exclude={counterId ? [counterId] : []} required={!isFree} placeholder="—" />
          )}
          <EffectLine account={main} side={side} amount={amount} />
        </div>
        <div>
          <label className="label">
            {isFree && fixedAccount ? (freeSide === "from" ? "إلى حساب" : "من حساب") : t.counter.label}
            {counterRequired ? <span className="text-red-500"> *</span> : <span className="text-xs text-gray-400"> (اختياري)</span>}
          </label>
          <AccountSelect accounts={accounts} value={counterId} onChange={setCounterId} kinds={t.counter.kinds}
            exclude={mainId ? [mainId] : []} required={counterRequired}
            placeholder={counterRequired ? "—" : "— بدون حساب مقابل —"} />
          <EffectLine account={counter} side={flip(side)} amount={amount} />
        </div>
      </div>
    </div>
  );
}
