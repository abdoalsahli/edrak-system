import Link from "next/link";
import { Search } from "lucide-react";
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
          // MySQL compares case-insensitively already; Prisma rejects `mode` on MySQL
          { fullName: { contains: q } },
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
        title="الحالات"
        description={total === 1 ? "حالة واحدة مسجلة" : total === 2 ? "حالتان مسجلتان" : total >= 3 && total <= 10 ? `${total} حالات مسجلة` : `${total} حالة مسجلة`}
        action={
          <Link href="/patients/new" className="btn-primary">
            + تسجيل حالة جديدة
          </Link>
        }
      />

      <div className="card p-5">
        {/* Search */}
        <form method="GET" className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
          <input
            name="q"
            defaultValue={q}
            placeholder="ابحث بالاسم أو الهاتف أو الهوية"
            className="input !rounded-full pr-11"
          />
        </form>

        {patients.length === 0 ? (
          <EmptyState
            title="لا توجد حالات"
            description={q ? "لم تتطابق أي حالة مع البحث" : "ابدأ بتسجيل أول حالة"}
            action={
              !q ? (
                <Link href="/patients/new" className="btn-primary">
                  تسجيل حالة جديدة
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
                <Th>الوضع</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {patients.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/patients/${p.id}`} className="font-medium text-gray-800 hover:text-primary-600">{p.fullName}</Link>
                  </Td>
                  <Td>
                    <Badge variant={p.patientType === "ADULT" ? "default" : "info"}>
                      {p.patientType === "ADULT" ? "بالغ" : "طفل"}
                    </Badge>
                  </Td>
                  <Td><bdi>{p.phone ?? "—"}</bdi></Td>
                  <Td>{p.guardian?.fullName ?? "—"}</Td>
                  <Td>
                    <Badge variant={p.isActive ? "success" : "gray"}>
                      {p.isActive ? "نشطة" : "غير نشطة"}
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
