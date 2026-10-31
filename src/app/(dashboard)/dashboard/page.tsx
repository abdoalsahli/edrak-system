import { prisma } from "@/lib/prisma";
import { getAccountBalances, getReceivables, getMonthlyFlow, getRecentDocuments } from "@/lib/billing/TreasuryService";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { arSA } from "date-fns/locale";
import {
  ClipboardList, Users, CalendarDays, UserX, Wallet, HandCoins, Stethoscope, FileWarning, CalendarClock,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChart } from "@/components/ui/AreaChart";
import { RecentDocuments } from "@/components/finance/RecentDocuments";
import { range12 } from "@/lib/time12";
import { TasksBanner } from "@/components/casePlans/TasksBanner";

const money = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل`;

/** «التحصيل الشهري» — receipts as an area, payments as a line. */
async function MonthlyChartCard() {
  const flow = await getMonthlyFlow(6);
  return (
    <div className="card p-6">
      <h2 className="mb-2 text-lg font-semibold text-gray-800">التحصيل الشهري</h2>
      <AreaChart
        labels={flow.labels}
        series={[
          { label: "المقبوض", color: "#2C22E7", values: flow.received, fill: true },
          { label: "المصروف", color: "#F7A224", values: flow.paid },
        ]}
      />
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const subtitle = `${format(today, "EEEE d MMMM yyyy", { locale: arSA })} — نظرة عامة على المركز`;

  if (role === "RECEPTIONIST") {
    const [todayApts, activePrograms, patientsWithBalance] = await Promise.all([
      prisma.appointment.findMany({
        where: { date: { gte: todayStart, lte: todayEnd }, status: "SCHEDULED", deletedAt: null },
        include: {
          session: { include: { patient: { select: { id: true, fullName: true } }, service: { select: { name: true } } } },
          therapist: { select: { fullName: true } },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.program.count({ where: { status: { in: ["ACTIVE", "EXTENDED"] } } }),
      getReceivables(5),
    ]);

    return (
      <div>
        <PageHeader title="لوحة التحكم" description={subtitle} />

        <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="مواعيد اليوم" value={todayApts.length} icon={CalendarClock} tone="primary" />
          <StatCard label="البرامج النشطة" value={activePrograms} icon={ClipboardList} tone="info" />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="card p-6 xl:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">مواعيد اليوم</h2>
            {todayApts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">لا توجد مواعيد اليوم</p>
            ) : (
              <ul className="divide-y divide-gray-300/70">
                {todayApts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/patients/${a.session.patient.id}`} className="font-medium text-gray-800 hover:text-primary-600">
                        {a.session.patient.fullName}
                      </Link>
                      <p className="text-xs text-gray-500">{a.session.service.name} · {a.therapist.fullName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">{range12(a.startTime, a.endTime)}</span>
                      <Link href={`/sessions/${a.session.id}`} className="text-xs font-medium text-primary-600 hover:underline">تسجيل</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">أرصدة مستحقة على الحالات</h2>
            {patientsWithBalance.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">لا توجد أرصدة مستحقة</p>
            ) : (
              <ul className="space-y-3">
                {patientsWithBalance.map((r) => (
                  <li key={r.accountId} className="flex items-center justify-between">
                    <Link href={`/patients/${r.patientId}`} className="text-sm font-medium text-gray-800 hover:text-primary-600">{r.name}</Link>
                    <span className="text-sm font-semibold text-red-600" dir="ltr">{money(r.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (role === "MANAGER") {
    const [activePrograms, activePatients, therapistCount, monthSessions, monthAbsent, ledger, monthCollected, docs] = await Promise.all([
      prisma.program.count({ where: { status: { in: ["ACTIVE", "EXTENDED"] } } }),
      prisma.patient.count({ where: { isActive: true } }),
      prisma.therapist.count({ where: { isActive: true } }),
      prisma.session.count({ where: { status: { in: ["COMPLETED", "ABSENT"] }, deliveredAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.session.count({ where: { status: "ABSENT", deliveredAt: { gte: monthStart, lte: monthEnd } } }),
      // Receivables and payables come from the current accounts
      getAccountBalances(new Date()),
      // Collected = actual cash received this month, net of refunds
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: monthStart, lte: monthEnd } } }),
      getRecentDocuments(5),
    ]);

    const collected = Number(monthCollected._sum.amount ?? 0);
    const absentRate = monthSessions > 0 ? Math.round((monthAbsent / monthSessions) * 100) : 0;

    const recentPrograms = await prisma.program.findMany({
      where: { status: { in: ["ACTIVE", "EXTENDED"] } },
      include: {
        patient: { select: { fullName: true } },
        service: { select: { name: true } },
        therapist: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return (
      <div>
        <PageHeader title="لوحة التحكم" description={subtitle} />
        <TasksBanner mode="manager" />

        <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="البرامج النشطة" value={activePrograms} icon={ClipboardList} tone="primary" />
          <StatCard label="الحالات النشطة" value={activePatients} icon={Users} tone="info" />
          <StatCard label="جلسات الشهر" value={monthSessions} icon={CalendarDays} tone="success" />
          <StatCard label="نسبة الغياب" value={`${absentRate}%`} icon={UserX} tone="danger" />
        </div>
        <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="المحصّل هذا الشهر" value={money(collected)} icon={Wallet} tone="success" />
          <StatCard label="المستحق على الحالات" value={money(ledger.totals.receivable)} icon={HandCoins} tone="warning" />
          <StatCard label="المستحق للأخصائيين" value={money(ledger.totals.payable)} icon={Stethoscope} tone="primary" />
          <StatCard label="المعالجون" value={therapistCount} icon={Users} tone="info" />
        </div>

        <div className="mb-6 grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2"><MonthlyChartCard /></div>
          <RecentDocuments docs={docs} />
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">البرامج النشطة</h2>
            <Link href="/programs" className="text-sm text-primary-600 hover:underline">عرض الكل</Link>
          </div>
          {recentPrograms.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">لا توجد برامج نشطة</p>
          ) : (
            <ul className="divide-y divide-gray-300/70">
              {recentPrograms.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link href={`/programs/${p.id}`} className="font-medium text-gray-800 hover:text-primary-600">
                      {p.patient.fullName}
                    </Link>
                    <p className="text-xs text-gray-500">{p.service.name} · {p.therapist.fullName}</p>
                  </div>
                  <Badge variant="success">نشط</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (role === "ACCOUNTANT") {
    const [owing, monthCollected, draftInvoices, ledger, docs] = await Promise.all([
      getReceivables(10),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: monthStart, lte: monthEnd } } }),
      prisma.invoice.count({ where: { status: "DRAFT" } }),
      getAccountBalances(new Date()),
      getRecentDocuments(5),
    ]);
    const owingCount = ledger.groups.PATIENT.filter((r) => r.balance > 0.005).length;

    return (
      <div>
        <PageHeader title="لوحة التحكم" description={subtitle} />

        <div className="mb-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="المستحق على الحالات" value={money(ledger.totals.receivable)} icon={HandCoins} tone="warning" />
          <StatCard label="المستحق للأخصائيين" value={money(ledger.totals.payable)} icon={Stethoscope} tone="primary" />
          <StatCard label="المحصّل هذا الشهر" value={money(Number(monthCollected._sum.amount ?? 0))} icon={Wallet} tone="success" />
          <StatCard label="فواتير مسودة" value={draftInvoices} icon={FileWarning} tone="danger" />
        </div>

        <div className="mb-6 grid gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2"><MonthlyChartCard /></div>
          <RecentDocuments docs={docs} />
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              أعلى الأرصدة المدينة <span className="text-xs font-normal text-gray-400">({owingCount} حساب)</span>
            </h2>
            <Link href="/finance/accounts?kind=PATIENT" className="text-sm text-primary-600 hover:underline">كل الحسابات</Link>
          </div>
          {owing.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">لا توجد أرصدة مستحقة</p>
          ) : (
            <ul className="divide-y divide-gray-300/70">
              {owing.map((r) => (
                <li key={r.accountId} className="flex items-center justify-between py-3">
                  <Link href={`/finance/accounts/${r.accountId}`} className="font-medium text-gray-800 hover:text-primary-600">{r.name}</Link>
                  <span className="text-sm font-semibold text-red-600" dir="ltr">{money(r.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  redirect("/login");
}
