import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));
  const perPage = 20;
  const q = searchParams.q ?? "";

  const where = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { nationalId: { contains: q } },
        ],
      }
    : {};

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { guardian: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.patient.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="المرضى"
        description={`${total} مريض مسجل`}
        action={
          <Link href="/patients/new" className="btn-primary">
            + تسجيل مريض جديد
          </Link>
        }
      />

      {/* Search */}
      <form method="GET" className="mb-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="بحث بالاسم أو الهاتف أو الهوية..."
          className="input max-w-sm"
        />
      </form>

      <div className="card">
        {patients.length === 0 ? (
          <EmptyState
            title="لا يوجد مرضى"
            description={q ? "لم يتطابق أي مريض مع البحث" : "ابدأ بتسجيل أول مريض"}
            action={
              !q ? (
                <Link href="/patients/new" className="btn-primary">
                  تسجيل مريض جديد
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>الاسم</Th>
                <Th>النوع</Th>
                <Th>الهاتف</Th>
                <Th>ولي الأمر</Th>
                <Th>الحالة</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {patients.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <span className="font-medium text-gray-900">{p.fullName}</span>
                  </Td>
                  <Td>
                    <Badge variant="gray">
                      {p.patientType === "ADULT" ? "بالغ" : "طفل"}
                    </Badge>
                  </Td>
                  <Td>{p.phone ?? "—"}</Td>
                  <Td>{p.guardian?.fullName ?? "—"}</Td>
                  <Td>
                    <Badge variant={p.isActive ? "success" : "gray"}>
                      {p.isActive ? "نشط" : "غير نشط"}
                    </Badge>
                  </Td>
                  <Td>
                    <Link
                      href={`/patients/${p.id}`}
                      className="text-primary-600 hover:underline text-xs font-medium"
                    >
                      عرض الملف
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {total > perPage && (
        <div className="mt-4 flex justify-between items-center text-sm text-gray-500">
          <span>
            عرض {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} من {total}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/patients?page=${page - 1}${q ? `&q=${q}` : ""}`}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                السابق
              </Link>
            )}
            {page * perPage < total && (
              <Link
                href={`/patients?page=${page + 1}${q ? `&q=${q}` : ""}`}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                التالي
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
