import { prisma } from "@/lib/prisma";
import { getAccountBalances, getReceivables } from "@/lib/billing/TreasuryService";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { arSA } from "date-fns/locale";
import { Badge } from "@/components/ui/Badge";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = session.user.role;

  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

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
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">لوحة تحكم الاستقبال</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500">مواعيد اليوم</p>
            <p className="text-3xl font-bold text-primary-700 mt-1">{todayApts.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500">البرامج النشطة</p>
            <p className="text-3xl font-bold text-primary-700 mt-1">{activePrograms}</p>
          </div>
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold">مواعيد اليوم — {format(today, "EEEE d MMMM yyyy", { locale: arSA })}</h2>
          </div>
          {todayApts.length === 0 ? (
            <p className="p-8 text-center text-gray-400">لا توجد مواعيد اليوم</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {todayApts.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/patients/${a.session.patient.id}`} className="font-medium text-gray-900 hover:underline">
                      {a.session.patient.fullName}
                    </Link>
                    <p className="text-xs text-gray-500">{a.session.service.name} · {a.therapist.fullName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm" dir="ltr">{a.startTime} – {a.endTime}</span>
                    <Link href={`/sessions/${a.session.id}`} className="text-primary-600 hover:underline text-xs">تسجيل</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {patientsWithBalance.length > 0 && (
          <div className="card">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold">أرصدة مستحقة على المرضى</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {patientsWithBalance.map((r) => (
                <div key={r.accountId} className="px-4 py-3 flex items-center justify-between">
                  <Link href={`/patients/${r.patientId}`} className="text-primary-600 hover:underline font-medium">
                    {r.name}
                  </Link>
                  <span className="text-sm text-red-600 font-medium" dir="ltr">
                    {r.balance.toFixed(2)} ر.س
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (role === "MANAGER") {
    const [activePrograms, activePatients, therapistCount, monthSessions, monthAbsent, ledger, monthCollected] = await Promise.all([
      prisma.program.count({ where: { status: { in: ["ACTIVE", "EXTENDED"] } } }),
      prisma.patient.count({ where: { isActive: true } }),
      prisma.therapist.count({ where: { isActive: true } }),
      prisma.session.count({ where: { status: { in: ["COMPLETED", "ABSENT"] }, deliveredAt: { gte: monthStart, lte: monthEnd } } }),
      prisma.session.count({ where: { status: "ABSENT", deliveredAt: { gte: monthStart, lte: monthEnd } } }),
      // Receivables and payables come from the current accounts
      getAccountBalances(new Date()),
      // Collected = actual cash received this month, net of refunds
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: monthStart, lte: monthEnd } } }),
    ]);

    const collected = Number(monthCollected._sum.amount ?? 0);
    const outstanding = ledger.totals.receivable;
    const commissionsDue = ledger.totals.payable;
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
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">لوحة تحكم المدير</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "البرامج النشطة", value: activePrograms },
            { label: "المرضى النشطون", value: activePatients },
            { label: "المعالجون", value: therapistCount },
            { label: "جلسات الشهر", value: monthSessions },
            { label: "نسبة الغياب", value: `${absentRate}%` },
            { label: "محصّل هذا الشهر", value: `${collected.toLocaleString("en-US")} ر.س` },
            { label: "مستحق على المرضى", value: `${outstanding.toLocaleString("en-US")} ر.س` },
            { label: "مستحق للأخصائيين", value: `${commissionsDue.toLocaleString("en-US")} ر.س` },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold text-primary-700 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">البرامج النشطة</h2>
            <Link href="/programs" className="text-sm text-primary-600 hover:underline">عرض الكل</Link>
          </div>
          {recentPrograms.length === 0 ? (
            <p className="p-8 text-center text-gray-400">لا توجد برامج نشطة</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentPrograms.map((p) => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/programs/${p.id}`} className="font-medium text-gray-900 hover:underline">
                      {p.patient.fullName}
                    </Link>
                    <p className="text-xs text-gray-500">{p.service.name} · {p.therapist.fullName}</p>
                  </div>
                  <Badge variant="success">نشط</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (role === "ACCOUNTANT") {
    const [owing, monthCollected, draftInvoices, ledger] = await Promise.all([
      getReceivables(10),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: monthStart, lte: monthEnd } } }),
      prisma.invoice.count({ where: { status: "DRAFT" } }),
      getAccountBalances(new Date()),
    ]);
    const owingCount = ledger.groups.PATIENT.filter((r) => r.balance > 0.005).length;

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">لوحة تحكم المحاسب</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "مستحق على المرضى", value: `${ledger.totals.receivable.toLocaleString("en-US")} ر.س` },
            { label: "مستحق للأخصائيين", value: `${ledger.totals.payable.toLocaleString("en-US")} ر.س` },
            { label: "محصّل هذا الشهر", value: `${Number(monthCollected._sum.amount ?? 0).toLocaleString("en-US")} ر.س` },
            { label: "فواتير مسودة", value: draftInvoices },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold text-primary-700 mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold">أعلى الأرصدة المدينة <span className="text-xs text-gray-400 font-normal">({owingCount} حساب)</span></h2>
            <Link href="/finance/accounts?kind=PATIENT" className="text-sm text-primary-600 hover:underline">كل الحسابات</Link>
          </div>
          {owing.length === 0 ? (
            <p className="p-8 text-center text-gray-400">لا توجد أرصدة مستحقة</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {owing.map((r) => (
                <div key={r.accountId} className="px-4 py-3 flex items-center justify-between">
                  <Link href={`/finance/accounts/${r.accountId}`} className="text-primary-600 hover:underline font-medium">
                    {r.name}
                  </Link>
                  <span className="text-red-600 font-medium text-sm" dir="ltr">{r.balance.toFixed(2)} ر.س</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  redirect("/login");
}
