import { prisma } from "@/lib/prisma";
import { getBalances, naturalBalance } from "@/lib/ledger/LedgerService";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

const SESSION_STATUS_LABELS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "gray" | "info" }> = {
  PENDING: { label: "مجدولة", variant: "info" },
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
        include: { service: true, therapist: true },
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

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center text-2xl">
            👤
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="gray">{patient.patientType === "ADULT" ? "بالغ" : "طفل"}</Badge>
              <Badge variant={patient.isActive ? "success" : "gray"}>
                {patient.isActive ? "نشط" : "غير نشط"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {/* The statement is financial data — accountants and managers only */}
          {session.user.role !== "RECEPTIONIST" && (
            <Link href={`/patients/${patient.id}/statement`} className="btn-primary">
              📄 كشف الحساب
            </Link>
          )}
          <Link href={`/patients/${patient.id}/edit`} className="btn-secondary">
            تعديل
          </Link>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">البيانات الشخصية</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">تاريخ الميلاد</dt>
              <dd className="font-medium">{dobFormatted}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">الجنس</dt>
              <dd className="font-medium">{genderLabel}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">الهاتف</dt>
              <dd className="font-medium" dir="ltr">{patient.phone ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">رقم الهوية</dt>
              <dd className="font-medium" dir="ltr">{patient.nationalId ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">العنوان</dt>
              <dd className="font-medium">{patient.address ?? "—"}</dd>
            </div>
          </dl>
        </div>

        {patient.guardian && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">ولي الأمر</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">الاسم</dt>
                <dd className="font-medium">{patient.guardian.fullName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">صلة القرابة</dt>
                <dd className="font-medium">{patient.guardian.relationship ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">الهاتف</dt>
                <dd className="font-medium" dir="ltr">{patient.guardian.phone ?? "—"}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">ملخص مالي</h2>
          <div className="text-3xl font-bold text-red-600">
            {totalOutstanding.toFixed(2)} ر.س
          </div>
          <p className="text-sm text-gray-500 mt-1">الرصيد المستحق</p>
          {session.user.role !== "RECEPTIONIST" && (
            <Link
              href={`/patients/${patient.id}/statement`}
              className="inline-block text-sm text-primary-600 hover:underline mt-3"
            >
              عرض كشف الحساب التفصيلي ←
            </Link>
          )}
        </div>
      </div>

      {/* Programs */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">البرامج العلاجية</h2>
          <Link href={`/programs/new?patientId=${patient.id}`} className="btn-primary text-xs px-3 py-1.5">
            + برنامج جديد
          </Link>
        </div>
        {patient.programs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">لا توجد برامج مسجلة</p>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>الخدمة</Th>
                <Th>المعالج</Th>
                <Th>تاريخ البدء</Th>
                <Th>الجلسات</Th>
                <Th>الحالة</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {patient.programs.map((prog) => {
                const s = PROGRAM_STATUS_LABELS[prog.status];
                return (
                  <Tr key={prog.id}>
                    <Td className="font-medium">{prog.service.name}</Td>
                    <Td>{prog.therapist.fullName}</Td>
                    <Td>{format(new Date(prog.startDate), "d/M/yyyy")}</Td>
                    <Td>{prog.plannedSessions}</Td>
                    <Td><Badge variant={s.variant}>{s.label}</Badge></Td>
                    <Td>
                      <Link href={`/programs/${prog.id}`} className="text-primary-600 hover:underline text-xs">
                        عرض
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Standalone sessions */}
      {patient.sessions.length > 0 && (
        <div className="card">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">الجلسات الفردية</h2>
          </div>
          <Table>
            <Thead>
              <tr>
                <Th>الخدمة</Th>
                <Th>الموعد</Th>
                <Th>الحالة</Th>
              </tr>
            </Thead>
            <Tbody>
              {patient.sessions.map((s) => {
                const apt = s.appointments[0];
                const st = SESSION_STATUS_LABELS[s.status];
                return (
                  <Tr key={s.id}>
                    <Td>{s.service.name}</Td>
                    <Td>{apt ? `${apt.date ? format(new Date(apt.date), "d/M/yyyy") : "—"} ${apt.startTime}` : "—"}</Td>
                    <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
