import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default async function TherapistsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const therapists = await prisma.therapist.findMany({
    include: { availability: { orderBy: { dayOfWeek: "asc" } } },
    orderBy: { fullName: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="المعالجون"
        description={`${therapists.length} معالج مسجل`}
        action={
          <Link href="/therapists/new" className="btn-primary">
            + إضافة معالج
          </Link>
        }
      />

      <div className="card">
        {therapists.length === 0 ? (
          <EmptyState
            title="لا يوجد معالجون"
            action={<Link href="/therapists/new" className="btn-primary">إضافة معالج</Link>}
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>الاسم</Th>
                <Th>التخصص</Th>
                <Th>الهاتف</Th>
                <Th>العمولة %</Th>
                <Th>أيام العمل</Th>
                <Th>الحالة</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {therapists.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-medium text-gray-900">{t.fullName}</Td>
                  <Td>{t.specialty ?? "—"}</Td>
                  <Td dir="ltr">{t.phone ?? "—"}</Td>
                  <Td dir="ltr">
                    {t.commissionType === "PERCENTAGE" && t.commissionRate
                      ? `${Number(t.commissionRate).toFixed(1)}%`
                      : t.commissionType === "FIXED" && t.commissionFixed
                      ? `${Number(t.commissionFixed).toFixed(2)} ر.س`
                      : "—"}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {t.availability.map((a) => (
                        <span key={a.dayOfWeek} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {DAYS_AR[a.dayOfWeek]}
                        </span>
                      ))}
                      {t.availability.length === 0 && <span className="text-gray-400 text-xs">غير محدد</span>}
                    </div>
                  </Td>
                  <Td>
                    <Badge variant={t.isActive ? "success" : "gray"}>
                      {t.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </Td>
                  <Td>
                    <Link href={`/therapists/${t.id}`} className="text-primary-600 hover:underline text-xs">
                      عرض / تعديل
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
