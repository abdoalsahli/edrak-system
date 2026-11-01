import Link from "next/link";
import { addDays, format } from "date-fns";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, REPORT_TABS } from "@/components/ui/SectionTabs";
import { Badge } from "@/components/ui/Badge";
import { PrintButton } from "@/app/(dashboard)/reports/PrintButton";
import { requireFinanceRole } from "../ReportShell";
import {
  getDailyMovement, CATEGORY_LABEL, CATEGORY_ORDER, type MovementCategory, type MovementLine,
} from "@/lib/billing/DailyMovementService";

const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const DAY_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const fmtDay = (iso: string) => { const d = new Date(iso); return `${DAY_AR[d.getDay()]} ${d.getDate()} ${MONTH_AR[d.getMonth()]} ${d.getFullYear()}`; };
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const time12 = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
};

const BADGE: Record<MovementCategory, "info" | "warning" | "success" | "danger" | "gray"> = {
  INVOICE: "info", COMMISSION: "warning", RECEIPT: "success", PAYMENT: "danger", TRANSFER: "gray", SETTLEMENT: "gray", OPENING: "gray",
};

const names = (list: { name: string }[]) => [...new Set(list.map((a) => a.name))].join("، ");

/** كشف الحركة اليومية — everything that changed any account, day by day. */
export default async function DailyMovementPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; type?: string; user?: string; box?: string };
}) {
  await requireFinanceRole();
  const today = format(new Date(), "yyyy-MM-dd");
  const fromIso = searchParams.from || today;
  const toIso = searchParams.to && searchParams.to >= fromIso ? searchParams.to : fromIso;
  const oneDay = fromIso === toIso;
  const category = CATEGORY_ORDER.includes(searchParams.type as MovementCategory) ? (searchParams.type as MovementCategory) : null;

  const data = await getDailyMovement({
    from: new Date(fromIso),
    to: new Date(toIso),
    category,
    userId: searchParams.user || null,
    boxAccountId: searchParams.box || null,
  });

  // Links keep the other filters
  const qs = (over: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const all = { from: fromIso, to: toIso, type: category, user: searchParams.user ?? null, box: searchParams.box ?? null, ...over };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `/finance/reports/daily?${p}`;
  };
  const shift = (days: number) => {
    const d = format(addDays(new Date(fromIso), days), "yyyy-MM-dd");
    return qs({ from: d, to: d });
  };

  const t = data.totals;
  const cards = [
    { label: "قيمة الجلسات والبرامج", value: t.charges, cls: "text-gray-800" },
    { label: "العمولات المرصودة", value: t.commissions, cls: "text-amber-700" },
    { label: "المقبوض", value: t.receipts, cls: "text-green-600" },
    { label: "المصروف", value: t.payments, cls: "text-red-600" },
  ];

  return (
    <div>
      <PageHeader
        title="التقارير"
        description={`كشف الحركة اليومية — ${oneDay ? fmtDay(fromIso) : `من ${fmtDay(fromIso)} إلى ${fmtDay(toIso)}`}`}
        action={<PrintButton />}
      />
      <SectionTabs tabs={REPORT_TABS} />

      {/* Period and filters */}
      <form method="get" className="card mb-5 flex flex-wrap items-end gap-3 p-4 print:hidden">
        <div className="flex items-end gap-1">
          <Link href={shift(-1)} className="btn-secondary px-3" title="اليوم السابق"><ChevronRight className="size-4" /></Link>
          <div>
            <label className="label text-xs">من</label>
            <input type="date" name="from" defaultValue={fromIso} className="input text-sm" dir="ltr" />
          </div>
          <div>
            <label className="label text-xs">إلى</label>
            <input type="date" name="to" defaultValue={oneDay ? "" : toIso} className="input text-sm" dir="ltr" />
          </div>
          <Link href={shift(1)} className="btn-secondary px-3" title="اليوم التالي"><ChevronLeft className="size-4" /></Link>
        </div>
        <div>
          <label className="label text-xs">النوع</label>
          <select name="type" defaultValue={category ?? ""} className="input text-sm">
            <option value="">كل الحركات</option>
            {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">الصندوق</label>
          <select name="box" defaultValue={searchParams.box ?? ""} className="input text-sm">
            <option value="">كل الحسابات</option>
            {data.boxes.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label text-xs">سجّلها</label>
          <select name="user" defaultValue={searchParams.user ?? ""} className="input text-sm">
            <option value="">الجميع</option>
            {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">عرض</button>
        {fromIso !== today || !oneDay ? <Link href={qs({ from: today, to: today })} className="text-sm text-primary-600 hover:underline pb-3">اليوم</Link> : null}
      </form>

      {/* Summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className={`mt-1 text-lg font-bold ${c.cls}`} dir="ltr">{money(c.value)}</p>
          </div>
        ))}
        <div className="card col-span-2 bg-primary-50 p-4 lg:col-span-1">
          <p className="text-xs text-primary-700">النقدية {searchParams.box ? "في الصندوق" : "في الخزينة"}</p>
          <p className="mt-1 text-sm text-primary-800">
            <span dir="ltr">{money(t.cashOpening)}</span> ← <b className="text-lg" dir="ltr">{money(t.cashClosing)}</b>
          </p>
          <p className="text-[11px] text-primary-700/70">{oneDay ? "أول اليوم ← آخر اليوم" : "أول الفترة ← آخرها"}</p>
        </div>
      </div>

      {data.lines.length === 0 ? (
        <p className="card p-10 text-center text-sm text-gray-400">لا توجد حركات {oneDay ? "في هذا اليوم" : "في هذه الفترة"}</p>
      ) : (
        <div className="space-y-5">
          {CATEGORY_ORDER.filter((c) => data.byCategory[c].count > 0).map((c) => (
            <Section key={c} category={c} lines={data.lines.filter((l) => l.category === c)} total={data.byCategory[c].amount} showDate={!oneDay} />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ category, lines, total, showDate }: { category: MovementCategory; lines: MovementLine[]; total: number; showDate: boolean }) {
  const signed = category === "INVOICE" || category === "COMMISSION";
  return (
    <section className="card overflow-hidden break-inside-avoid">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold text-gray-800">
          {CATEGORY_LABEL[category]} <span className="text-xs font-normal text-gray-400">({lines.length})</span>
        </h2>
        <b className="text-gray-800" dir="ltr">{money(total)}</b>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-start font-medium" data-card="title">البيان</th>
              <th className="px-4 py-2 text-start font-medium" data-card="meta">{showDate ? "التاريخ" : "الوقت"}</th>
              <th className="px-4 py-2 text-start font-medium" data-card="meta">المستند</th>
              <th className="px-4 py-2 text-start font-medium">من ← إلى</th>
              <th className="px-4 py-2 text-start font-medium">سجّلها</th>
              <th className="px-4 py-2 text-start font-medium" data-card="amount">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className="border-t border-gray-100 align-top">
                <td className="min-w-[14rem] px-4 py-2.5 text-gray-800">
                  {l.href ? <Link href={l.href} className="text-primary-600 hover:underline">{l.description}</Link> : l.description}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{showDate ? fmtDay(l.date) : time12(l.time)}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {l.reference ? <span className="font-mono text-xs text-gray-600" dir="ltr">{l.reference}</span> : <Badge variant={BADGE[category]}>تلقائي</Badge>}
                </td>
                <td className="px-4 py-2.5 text-gray-700">
                  {l.from.length > 0 && l.to.length > 0 ? <>{names(l.from)} ← {names(l.to)}</> : names([...l.from, ...l.to])}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{l.userName ?? "—"}</td>
                <td
                  className={`whitespace-nowrap px-4 py-2.5 font-semibold ${signed && l.amount < 0 ? "text-red-600" : "text-gray-800"}`}
                  dir="ltr"
                >
                  {signed && l.amount < 0 ? `−${money(-l.amount)}` : money(l.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
