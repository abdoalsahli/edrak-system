import { prisma } from "@/lib/prisma";
import { getBalances, naturalBalance } from "@/lib/ledger/LedgerService";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { PageHeader } from "@/components/ui/PageHeader";
import { FileText, CalendarPlus, User, Phone, IdCard, MapPin, Cake } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { to12 } from "@/lib/time12";

const SESSION_STATUS_LABELS: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "gray" | "info" }> = {
  PENDING: { label: "مجدولة", variant: "default" },
  COMPLETED: { label: "مكتملة", variant: "success" },
  ABSENT: { label: "غياب", variant: "danger" },
  CANCELLED_BY_PATIENT: { label: "ألغاها المريض", variant: "warning" },
  CANCELLED_BY_CENTER: { label: "ألغاها المركز", variant: "gray" },
};

const PROGRAM_STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "gray" | "info" }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  COMPLETED: { label: "مكتمل", variant: "info" },
  EXTENDED: { label: "ممتد", variant: "warning" },
  CANCELLED: { label: "ملغى", variant: "danger" },
};

export default async function PatientProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      guardian: true,
      programs: {
        include: {
          service: true,
          therapist: true,
          // delivered (or charged-absent) sessions, for the progress bar
          _count: { select: { sessions: { where: { status: { in: ["COMPLETED", "ABSENT"] } } } } },
        },
        orderBy: { createdAt: "desc" },
      },
      sessions: {
        where: { programId: null },
        include: {
          service: true,
          appointments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        where: { status: { not: "VOID" } },
        orderBy: { issueDate: "desc" },
      },
    },
  });

  if (!patient) notFound();

  const genderLabel = patient.gender === "male" ? "ذكر" : patient.gender === "female" ? "أنثى" : "—";
  const dobFormatted = patient.dob ? format(new Date(patient.dob), "d MMMM yyyy", { locale: ar }) : "—";

  // What the patient owes = the balance of their current account
  const ledgerAccount = await prisma.ledgerAccount.findUnique({
    where: { patientId: patient.id },
    select: { id: true, nature: true },
  });
  const sums = ledgerAccount ? await getBalances(prisma, { accountIds: [ledgerAccount.id] }) : null;
  const t = (ledgerAccount && sums?.get(ledgerAccount.id)) || { debit: 0, credit: 0 };
  const totalOutstanding = ledgerAccount ? naturalBalance(ledgerAccount.nature, t.debit, t.credit) : 0;

  const age = patient.dob ? Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const typeLabel = patient.patientType === "ADULT" ? "بالغ" : "طفل";
  const canSeeMoney = session.user.role !== "RECEPTIONIST";

  return (
    <div>
      <PageHeader
        title={patient.fullName}
        description="ملف المريض"
        action={
          <>
            {/* The statement is financial data — accountants and managers only */}
            {canSeeMoney && (
              <Link href={`/patients/${patient.id}/statement`} className="btn-secondary"><FileText className="size-4" />كشف الحساب</Link>
            )}
            <Link href="/sessions" className="btn-primary"><CalendarPlus className="size-4" />حجز جلسة</Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Profile column */}
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="grid size-20 place-items-center rounded-full bg-gradient-primary text-3xl font-bold text-white">
                {patient.fullName.charAt(0)}
              </div>
              <p className="mt-3 text-lg font-semibold text-gray-800">{patient.fullName}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <Badge variant="info">{typeLabel}{age != null ? ` · ${age} سنوات` : ""}</Badge>
                {!patient.isActive && <Badge variant="gray">غير نشط</Badge>}
              </div>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              {patient.guardian && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-gray-500"><User className="size-4" />ولي الأمر</dt>
                  <dd className="font-medium text-gray-800">{patient.guardian.fullName}</dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-gray-500"><Phone className="size-4" />الهاتف</dt>
                <dd className="font-medium text-gray-800"><bdi>{patient.phone ?? patient.guardian?.phone ?? "—"}</bdi></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-gray-500"><Cake className="size-4" />تاريخ الميلاد</dt>
                <dd className="font-medium text-gray-800">{dobFormatted}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-gray-500"><User className="size-4" />الجنس</dt>
                <dd className="font-medium text-gray-800">{genderLabel}</dd>
              </div>
              {patient.nationalId && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-gray-500"><IdCard className="size-4" />رقم الهوية</dt>
                  <dd className="font-medium text-gray-800"><bdi>{patient.nationalId}</bdi></dd>
                </div>
              )}
              {patient.address && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-gray-500"><MapPin className="size-4" />العنوان</dt>
                  <dd className="font-medium text-gray-800">{patient.address}</dd>
                </div>
              )}
            </dl>

            <div className="mt-6 rounded-2xl bg-gradient-primary p-5 text-white">
              <p className="text-sm opacity-80">{totalOutstanding < 0 ? "رصيد لصالح المريض" : "الرصيد المستحق"}</p>
              <p className="mt-1 text-3xl font-bold">{Math.abs(totalOutstanding).toLocaleString("en-US", { maximumFractionDigits: 2 })} د.ل</p>
              {canSeeMoney && (
                <Link href={`/patients/${patient.id}/statement`} className="mt-2 inline-block text-xs underline opacity-80 hover:opacity-100">
                  عرض كشف الحساب التفصيلي
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Programmes and sessions */}
        <div className="space-y-5 lg:col-span-2">
          <div className="card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">البرامج العلاجية</h2>
              <Link href={`/programs/new?patientId=${patient.id}`} className="text-sm text-primary-600 hover:underline">+ برنامج جديد</Link>
            </div>
            {patient.programs.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">لا توجد برامج مسجلة</p>
            ) : (
              <div className="space-y-3">
                {patient.programs.map((prog) => {
                  const st = PROGRAM_STATUS_LABELS[prog.status];
                  const done = prog._count.sessions;
                  const pct = prog.plannedSessions > 0 ? Math.min(100, Math.round((done / prog.plannedSessions) * 100)) : 0;
                  return (
                    <Link key={prog.id} href={`/programs/${prog.id}`} className="block rounded-2xl border border-gray-300 p-4 transition hover:bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-gray-800">{prog.service.name}</p>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        {done} من {prog.plannedSessions} جلسة · {prog.therapist.fullName} · منذ {format(new Date(prog.startDate), "d/M/yyyy")}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="mb-2 text-lg font-semibold text-gray-800">الجلسات الفردية</h2>
            {patient.sessions.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">لا توجد جلسات فردية</p>
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>الخدمة</Th>
                    <Th>اليوم</Th>
                    <Th>الوقت</Th>
                    {canSeeMoney && <Th>القيمة</Th>}
                    <Th>الحالة</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {patient.sessions.map((s) => {
                    const apt = s.appointments[0];
                    const st = SESSION_STATUS_LABELS[s.status];
                    return (
                      <Tr key={s.id}>
                        <Td><Link href={`/sessions/${s.id}`} className="font-medium text-gray-800 hover:text-primary-600">{s.service.name}</Link></Td>
                        <Td>{apt?.date ? format(new Date(apt.date), "EEEE d/M/yyyy", { locale: ar }) : "—"}</Td>
                        <Td>{to12(apt?.startTime)}</Td>
                        {canSeeMoney && <Td>{Number(s.price ?? 0).toLocaleString("en-US")} د.ل</Td>}
                        <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
