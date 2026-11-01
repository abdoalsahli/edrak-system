"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiError } from "@/lib/apiError";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatementView } from "@/components/finance/StatementView";

type Source = "OPENING" | "INVOICE" | "RECEIPT" | "PAYMENT" | "COMMISSION" | "SETTLEMENT";
type Entry = { id: string; date: string; sourceType: Source; reference: string | null; description: string; debit: number; credit: number; balance: number };
type Statement = {
  account: { code: string; name: string };
  broughtForward: number;
  totals: { totalDebit: number; totalCredit: number; balance: number };
  entries: Entry[];
  commissions: { earned: { amount: number; sessions: number }; ahead: { amount: number; sessions: number } };
};

const SOURCE: Record<Source, { label: string; variant: "info" | "success" | "danger" | "warning" | "gray" }> = {
  OPENING: { label: "افتتاحي", variant: "gray" },
  INVOICE: { label: "فاتورة", variant: "info" },
  RECEIPT: { label: "قبض", variant: "success" },
  PAYMENT: { label: "صرف لك", variant: "danger" },
  COMMISSION: { label: "عمولة", variant: "warning" },
  SETTLEMENT: { label: "تسوية", variant: "gray" },
};

const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const fmtDate = (iso: string) => { const d = new Date(iso); return `${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; };
const money = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** كشف حسابي — the therapist's own current account (credit nature: positive = owed to them). */
export default function MyStatementPage() {
  const [data, setData] = useState<Statement | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const res = await fetch(`/api/my/statement?${qs}`);
    if (res.ok) setData(await res.json());
    else setError(await readApiError(res, "تعذّر تحميل الكشف"));
    setLoading(false);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const balance = data?.totals.balance ?? 0;

  return (
    <div className="max-w-4xl">
      <PageHeader title="كشف حسابي" description={data ? `${data.account.name} · ${data.account.code}` : undefined} />

      {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg mb-4">{error}</p>}

      {data && (
        <>
          {/* Where the balance stands */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className={`rounded-xl p-4 ${balance >= 0 ? "bg-primary-50 text-primary-800" : "bg-red-50 text-red-700"}`}>
              <p className="text-xs opacity-75">{balance >= 0 ? "رصيدك لدى المركز" : "رصيد عليك للمركز"}</p>
              <p className="text-2xl font-bold mt-1" dir="ltr">{money(Math.abs(balance))}</p>
              <p className="text-xs opacity-75 mt-1">{to ? `حتى ${fmtDate(to)}` : "حتى اليوم"}</p>
            </div>
            <div className="rounded-xl p-4 bg-green-50 text-green-800">
              <p className="text-xs opacity-75">عمولات مستحقة عن جلسات منفّذة</p>
              <p className="text-2xl font-bold mt-1" dir="ltr">{money(data.commissions.earned.amount)}</p>
              <p className="text-xs opacity-75 mt-1">{data.commissions.earned.sessions} جلسة لم تُصرف بعد</p>
            </div>
            <div className="rounded-xl p-4 bg-amber-50 text-amber-800">
              <p className="text-xs opacity-75">عمولات مسجّلة مقدّماً لجلسات قادمة</p>
              <p className="text-2xl font-bold mt-1" dir="ltr">{money(data.commissions.ahead.amount)}</p>
              <p className="text-xs opacity-75 mt-1">{data.commissions.ahead.sessions} جلسة ضمن برامج جارية</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            عمولة البرنامج تُسجَّل في حسابك عند إنشائه، وتُعدَّل إذا انتهى البرنامج قبل اكتمال جلساته أو أُلغي أو مُدِّد.
            ما يُصرف لك يظهر بالسالب (−) وما يُضاف لك بالموجب (+).
          </p>
        </>
      )}

      {/* Period */}
      <div className="card p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label text-xs">من تاريخ</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input text-sm" dir="ltr" />
        </div>
        <div>
          <label className="label text-xs">إلى تاريخ</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input text-sm" dir="ltr" />
        </div>
        {(from || to) && (
          <button onClick={() => { setFrom(""); setTo(""); }} className="text-sm text-primary-600 hover:underline pb-2">كل الفترات</button>
        )}
        {loading && <span className="text-xs text-gray-400 pb-2">جارٍ التحميل...</span>}
      </div>

      {data && (
        <StatementView
          entries={data.entries}
          totals={data.totals}
          broughtForward={data.broughtForward}
          showBroughtForward={!!from}
          nature="CREDIT"
          sources={SOURCE}
        />
      )}
    </div>
  );
}
