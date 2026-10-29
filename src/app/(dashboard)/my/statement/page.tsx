"use client";

import { useCallback, useEffect, useState } from "react";
import { readApiError } from "@/lib/apiError";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";

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
            ما يُصرف لك يظهر في عمود «مدين».
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
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">التاريخ</th>
                  <th className="px-4 py-2.5 text-start font-medium">النوع</th>
                  <th className="px-4 py-2.5 text-start font-medium">البيان</th>
                  <th className="px-4 py-2.5 text-start font-medium">مدين</th>
                  <th className="px-4 py-2.5 text-start font-medium">دائن</th>
                  <th className="px-4 py-2.5 text-start font-medium">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {from && (
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-500" colSpan={5}>رصيد أول المدة</td>
                    <td className="px-4 py-2 font-medium" dir="ltr">{money(data.broughtForward)}</td>
                  </tr>
                )}
                {data.entries.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">لا توجد حركات في هذه الفترة</td></tr>
                ) : (
                  data.entries.map((e) => {
                    const s = SOURCE[e.sourceType];
                    return (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(e.date)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <Badge variant={s.variant}>{s.label}</Badge>
                          {e.reference && <span className="block font-mono text-xs text-gray-400 mt-0.5" dir="ltr">{e.reference}</span>}
                        </td>
                        <td className="px-4 py-2.5">{e.description}</td>
                        <td className="px-4 py-2.5 text-red-600" dir="ltr">{e.debit ? money(e.debit) : "—"}</td>
                        <td className="px-4 py-2.5 text-green-700" dir="ltr">{e.credit ? money(e.credit) : "—"}</td>
                        <td className={`px-4 py-2.5 font-medium ${e.balance < 0 ? "text-red-600" : ""}`} dir="ltr">{money(e.balance)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {data.entries.length > 0 && (
                <tfoot className="bg-gray-50 font-semibold text-sm">
                  <tr>
                    <td className="px-4 py-2.5" colSpan={3}>الإجمالي</td>
                    <td className="px-4 py-2.5 text-red-600" dir="ltr">{money(data.totals.totalDebit)}</td>
                    <td className="px-4 py-2.5 text-green-700" dir="ltr">{money(data.totals.totalCredit)}</td>
                    <td className="px-4 py-2.5" dir="ltr">{money(data.totals.balance)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
