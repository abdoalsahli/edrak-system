"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { VoucherModal, type VoucherKind } from "@/components/finance/VoucherModal";
import { ArrowLeftRight, Printer } from "lucide-react";
import { StatementView } from "@/components/finance/StatementView";

type Kind = "PATIENT" | "THERAPIST" | "EXPENSE" | "CUSTOM" | "CASH";
type Nature = "DEBIT" | "CREDIT";
type Source = "OPENING" | "INVOICE" | "RECEIPT" | "PAYMENT" | "COMMISSION" | "SETTLEMENT";

type Entry = {
  id: string;
  date: string;
  sourceType: Source;
  sourceId: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  href: string | null;
};

type Statement = {
  account: {
    id: string; code: string; name: string; kind: Kind; nature: Nature; isActive: boolean;
    notes: string | null; patientId: string | null; therapistId: string | null;
  };
  broughtForward: number;
  entries: Entry[];
  totals: { totalDebit: number; totalCredit: number; balance: number };
};

const SOURCE_BADGE: Record<Source, { label: string; variant: "info" | "success" | "danger" | "warning" | "gray" }> = {
  OPENING: { label: "افتتاحي", variant: "gray" },
  INVOICE: { label: "فاتورة", variant: "info" },
  RECEIPT: { label: "سند قبض", variant: "success" },
  PAYMENT: { label: "سند صرف", variant: "danger" },
  COMMISSION: { label: "عمولة", variant: "warning" },
  SETTLEMENT: { label: "تسوية", variant: "gray" },
};

const KIND_AR: Record<Kind, string> = {
  PATIENT: "حساب حالة", THERAPIST: "حساب أخصائي", EXPENSE: "حساب مصروف", CUSTOM: "حساب عام", CASH: "صندوق / بنك",
};

const MONTH_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const fmtDate = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTH_AR[m - 1]} ${y}`; };
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cell = (n: number) => (n === 0 ? "—" : money(n));

/** Plain-language meaning of the balance, from the centre's point of view. */
function balanceMeaning(kind: Kind, nature: Nature, balance: number): { text: string; tone: string } {
  if (Math.abs(balance) < 0.005) return { text: "الحساب متوازن", tone: "bg-green-50 border-green-200 text-green-700" };
  const debitSide = (nature === "DEBIT") === balance > 0;
  if (kind === "CASH") return balance > 0
    ? { text: "الرصيد النقدي", tone: "bg-primary-50 border-primary-200 text-primary-800" }
    : { text: "رصيد سالب — راجع الصندوق", tone: "bg-red-50 border-red-200 text-red-700" };
  if (kind === "EXPENSE") return { text: balance > 0 ? "إجمالي المصروف" : "مبالغ مستردة", tone: "bg-amber-50 border-amber-200 text-amber-800" };
  if (kind === "PATIENT") return debitSide
    ? { text: "مستحق على الحالة (مدين)", tone: "bg-red-50 border-red-200 text-red-700" }
    : { text: "رصيد للحالة (دائن)", tone: "bg-amber-50 border-amber-200 text-amber-800" };
  if (kind === "THERAPIST") return debitSide
    ? { text: "سُلفة على الأخصائي (مدين)", tone: "bg-blue-50 border-blue-200 text-blue-700" }
    : { text: "مستحق للأخصائي (دائن)", tone: "bg-amber-50 border-amber-200 text-amber-800" };
  return debitSide
    ? { text: "رصيد مدين", tone: "bg-red-50 border-red-200 text-red-700" }
    : { text: "رصيد دائن", tone: "bg-amber-50 border-amber-200 text-amber-800" };
}

export default function AccountStatementPage() {
  // useParams keeps the segment URL-encoded ("patient%3A…"); decode before re-encoding
  const id = decodeURIComponent(useParams<{ id: string }>().id);
  const searchParams = useSearchParams();
  const [data, setData] = useState<Statement | null>(null);
  const [missing, setMissing] = useState(false);
  const [from, setFrom] = useState(searchParams.get("from") ?? "");
  const [to, setTo] = useState(searchParams.get("to") ?? "");
  const [voucher, setVoucher] = useState<VoucherKind | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/ledger/accounts/${encodeURIComponent(id)}?${qs}`);
    if (res.status === 404) { setMissing(true); return; }
    if (res.ok) setData(await res.json());
  }, [id, from, to]);

  useEffect(() => { load(); }, [load]);

  if (missing) return <div className="text-gray-500 p-8 text-center">الحساب غير موجود</div>;
  if (!data) return <div className="text-gray-400 p-8 text-center">جارٍ التحميل...</div>;

  const { account, broughtForward, entries, totals } = data;
  const meaning = balanceMeaning(account.kind, account.nature, totals.balance);
  const partyLink = account.patientId ? `/patients/${account.patientId}` : account.therapistId ? `/therapists/${account.therapistId}` : null;
  const isCash = account.kind === "CASH";

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={`كشف حساب — ${account.name}`}
        description={
          <span className="flex items-center gap-3 text-sm">
            <span className="font-mono text-gray-500" dir="ltr">{account.code}</span>
            <span>{KIND_AR[account.kind]} · طبيعته {account.nature === "DEBIT" ? "مدين" : "دائن"}</span>
            {!account.isActive && <Badge variant="gray">معطّل</Badge>}
            {partyLink && <Link href={partyLink} className="text-primary-600 hover:underline">الملف ←</Link>}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            {account.isActive && !isCash && (
              <>
                <button onClick={() => setVoucher("receipt")} className="btn-primary text-sm">+ سند قبض</button>
                <button onClick={() => setVoucher("payment")} className="btn-secondary text-sm">− سند صرف</button>
              </>
            )}
            {account.isActive && (
              <button onClick={() => setVoucher("settlement")} className="btn-secondary text-sm">
                <ArrowLeftRight className="size-4" />{isCash ? "تحويل / تسوية" : "تسوية"}
              </button>
            )}
            <button onClick={() => window.print()} className="btn-secondary text-sm"><Printer className="size-4" />طباعة</button>
          </div>
        }
      />

      <div className="card p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs">من تاريخ</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input text-sm" dir="ltr" />
        </div>
        <div>
          <label className="label text-xs">إلى تاريخ</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input text-sm" dir="ltr" />
        </div>
        {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} className="btn-secondary text-sm">كل الفترات</button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="card p-4">
          <p className="text-xs text-gray-500">{from ? "رصيد مرحّل" : "رصيد أول المدة"}</p>
          <p className="text-lg font-bold text-gray-800 mt-1" dir="ltr">{money(broughtForward)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">{isCash ? "إجمالي الوارد (مدين)" : "إجمالي المدين"}</p>
          <p className="text-lg font-bold text-gray-800 mt-1" dir="ltr">{money(totals.totalDebit)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">{isCash ? "إجمالي الصادر (دائن)" : "إجمالي الدائن"}</p>
          <p className="text-lg font-bold text-gray-800 mt-1" dir="ltr">{money(totals.totalCredit)}</p>
        </div>
        <div className={`card p-4 border ${meaning.tone}`}>
          <p className="text-xs">{meaning.text}</p>
          <p className="text-lg font-bold mt-1" dir="ltr">{money(Math.abs(totals.balance))} د.ل</p>
        </div>
      </div>

      <StatementView
        entries={entries}
        totals={totals}
        broughtForward={broughtForward}
        showBroughtForward
        broughtForwardLabel={from ? "رصيد مرحّل من الفترة السابقة" : "رصيد أول المدة"}
        nature={account.nature}
        sources={SOURCE_BADGE}
      />

      <p className="text-xs text-gray-400 mt-3">
        الرصيد يُقرأ حسب طبيعة الحساب ({account.nature === "DEBIT" ? "مدين: المدين − الدائن" : "دائن: الدائن − المدين"}).
        القيود لا تُعدَّل بعد ترحيلها — أي تغيير يظهر كقيد تعديل بتاريخه.
        {isCash && " لنقل المال بين الصناديق، أو تسجيل عجز وزيادة الجرد، استخدم «تحويل / تسوية»."}
      </p>

      <VoucherModal
        open={voucher !== null}
        kind={voucher ?? "receipt"}
        onClose={() => setVoucher(null)}
        fixedAccount={{ id: account.id, code: account.code, name: account.name, kind: account.kind, nature: account.nature, balance: totals.balance }}
        onDone={(doc) => { load(); if (doc.voucherNumber) alert(`تم إصدار المستند رقم ${doc.voucherNumber}`); }}
      />
    </div>
  );
}
