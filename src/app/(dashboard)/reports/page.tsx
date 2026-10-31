import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { SectionTabs, REPORT_TABS } from "@/components/ui/SectionTabs";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; report?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "RECEPTIONIST") redirect("/dashboard");

  const today = new Date();
  const defaultFrom = format(startOfMonth(today), "yyyy-MM-dd");
  const defaultTo = format(endOfMonth(today), "yyyy-MM-dd");
  const from = new Date(searchParams.from ?? defaultFrom);
  const to = new Date(searchParams.to ?? defaultTo);
  const report = searchParams.report ?? "billing";
  // Financial reports moved under المالية
  if (report === "balances" || report === "treasury") {
    const qs = new URLSearchParams();
    if (searchParams.from) qs.set("from", searchParams.from);
    if (searchParams.to) qs.set("to", searchParams.to);
    redirect(`/finance/reports/${report}${qs.toString() ? `?${qs}` : ""}`);
  }

  let content: React.ReactNode = null;

  if (report === "billing") {
    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: from, lte: to } },
      include: {
        account: { select: { name: true } },
        patient: { select: { fullName: true } },
        paymentMethod: { select: { name: true } },
        invoice: {
          include: {
            billingCycle: { select: { program: { select: { service: { select: { name: true } } } } } },
          },
        },
      },
      orderBy: { paymentDate: "asc" },
    });

    const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);

    const methodTotals = payments.reduce<Record<string, number>>((acc, p) => {
      acc[p.paymentMethod.name] = (acc[p.paymentMethod.name] ?? 0) + Number(p.amount);
      return acc;
    }, {});

    content = (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-gray-500">إجمالي المحصّل</p>
            <p className="text-xl font-bold text-green-700 mt-1">{totalCollected.toLocaleString("en-US")} د.ل</p>
          </div>
          {Object.entries(methodTotals).map(([m, v]) => (
            <div key={m} className="card p-4">
              <p className="text-xs text-gray-500">{m}</p>
              <p className="text-xl font-bold text-primary-700 mt-1">{v.toLocaleString("en-US")} د.ل</p>
            </div>
          ))}
        </div>

        <div className="card">
          <Table>
            <Thead>
              <tr>
                <Th>التاريخ</Th>
                <Th>السند</Th>
                <Th>الحساب</Th>
                <Th>الطريقة</Th>
                <Th>المبلغ</Th>
              </tr>
            </Thead>
            <Tbody>
              {payments.map((p) => (
                <Tr key={p.id}>
                  <Td>{format(new Date(p.paymentDate), "d MMM yyyy", { locale: arSA })}</Td>
                  <Td><span className="font-mono text-xs" dir="ltr">{p.voucherNumber}</span></Td>
                  <Td>{p.account?.name ?? p.patient?.fullName ?? "—"}</Td>
                  <Td>{p.paymentMethod.name}</Td>
                  <Td dir="ltr">{Number(p.amount).toFixed(2)} د.ل</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </div>
    );
  }

  if (report === "therapist") {
    const therapists = await prisma.therapist.findMany({
      where: { isActive: true },
      include: {
        appointments: {
          where: {
            status: "DELIVERED",
            date: { gte: from, lte: to },
            deletedAt: null,
          },
        },
      },
      orderBy: { fullName: "asc" },
    });

    content = (
      <div className="card">
        <Table>
          <Thead>
            <tr>
              <Th>المعالج</Th>
              <Th>التخصص</Th>
              <Th>جلسات مُقدَّمة</Th>
            </tr>
          </Thead>
          <Tbody>
            {therapists.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium">{t.fullName}</Td>
                <Td>{t.specialty ?? "—"}</Td>
                <Td>{t.appointments.length}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    );
  }

  if (report === "programs") {
    const programs = await prisma.program.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        patient: { select: { fullName: true } },
        therapist: { select: { fullName: true } },
        service: { select: { name: true } },
        sessions: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    content = (
      <div className="card">
        <Table>
          <Thead>
            <tr>
              <Th>الحالة</Th>
              <Th>الخدمة</Th>
              <Th>المعالج</Th>
              <Th>مخطط</Th>
              <Th>مكتمل</Th>
              <Th>غياب</Th>
              <Th>الحالة</Th>
            </tr>
          </Thead>
          <Tbody>
            {programs.map((p) => {
              const completed = p.sessions.filter((s) => s.status === "COMPLETED").length;
              const absent = p.sessions.filter((s) => s.status === "ABSENT").length;
              return (
                <Tr key={p.id}>
                  <Td><Link href={`/programs/${p.id}`} className="text-primary-600 hover:underline">{p.patient.fullName}</Link></Td>
                  <Td>{p.service.name}</Td>
                  <Td>{p.therapist.fullName}</Td>
                  <Td>{p.plannedSessions}</Td>
                  <Td>{completed}</Td>
                  <Td>{absent}</Td>
                  <Td>{p.status}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="التقارير" />
      <SectionTabs tabs={REPORT_TABS} />

      {/* Report type tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { key: "billing", label: "تقرير المدفوعات" },
          { key: "therapist", label: "إنتاجية المعالجين" },
          { key: "programs", label: "البرامج" },
        ].map((r) => (
          <Link
            key={r.key}
            href={`/reports?report=${r.key}&from=${searchParams.from ?? defaultFrom}&to=${searchParams.to ?? defaultTo}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${report === r.key ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      {/* Date range filter */}
      <form method="get" className="flex gap-2 mb-6">
        <input type="hidden" name="report" value={report} />
        <div>
          <label className="label text-xs">من</label>
          <input type="date" name="from" defaultValue={searchParams.from ?? defaultFrom} className="input" dir="ltr" />
        </div>
        <div>
          <label className="label text-xs">إلى</label>
          <input type="date" name="to" defaultValue={searchParams.to ?? defaultTo} className="input" dir="ltr" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-secondary">تطبيق</button>
        </div>
      </form>

      {content}
    </div>
  );
}
