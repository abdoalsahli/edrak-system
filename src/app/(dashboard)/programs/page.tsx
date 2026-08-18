import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table, Thead, Th, Tbody, Tr, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 20;

const STATUS_MAP: Record<string, { label: string; variant: "success" | "danger" | "warning" | "gray" | "default" | "info" }> = {
  ACTIVE: { label: "نشط", variant: "success" },
  COMPLETED: { label: "مكتمل", variant: "info" },
  EXTENDED: { label: "ممتد", variant: "warning" },
  CANCELLED: { label: "ملغي", variant: "danger" },
};

export default async function ProgramsPage({ searchParams }: { searchParams: { page?: string; q?: string; status?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const page = parseInt(searchParams.page ?? "1");
  const skip = (page - 1) * PAGE_SIZE;
  const q = searchParams.q ?? "";
  const statusFilter = searchParams.status ?? "";

  const where = {
    ...(q ? { patient: { fullName: { contains: q } } } : {}),
    ...(statusFilter ? { status: statusFilter as never } : {}),
  };

  const [programs, total] = await Promise.all([
    prisma.program.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true } },
        therapist: { select: { fullName: true } },
        service: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.program.count({ where }),
  ]);

  const programIds = programs.map((p) => p.id);
  const consumed = await prisma.session.groupBy({
    by: ["programId"],
    where: { programId: { in: programIds }, status: { in: ["COMPLETED", "ABSENT"] } },
    _count: { _all: true },
  });
  const consumedMap = Object.fromEntries(consumed.map((c) => [c.programId!, c._count._all]));

  return (
    <div>
      <PageHeader
        title="البرامج العلاجية"
        description={`${total} برنامج`}
        action={<Link href="/programs/new" className="btn-primary">+ برنامج جديد</Link>}
      />

      <div className="mb-4 flex gap-2">
        <form method="get" className="flex gap-2 flex-1">
          <input name="q" defaultValue={q} placeholder="بحث بالاسم..." className="input max-w-xs" />
          <select name="status" defaultValue={statusFilter} className="input max-w-[160px]">
            <option value="">جميع الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="COMPLETED">مكتمل</option>
            <option value="EXTENDED">ممتد</option>
            <option value="CANCELLED">ملغي</option>
          </select>
          <button type="submit" className="btn-secondary">بحث</button>
        </form>
      </div>

      <div className="card">
        {programs.length === 0 ? (
          <EmptyState title="لا توجد برامج" action={<Link href="/programs/new" className="btn-primary">+ برنامج جديد</Link>} />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>المريض</Th>
                <Th>الخدمة</Th>
                <Th>المعالج</Th>
                <Th>التقدم</Th>
                <Th>تاريخ البدء</Th>
                <Th>الحالة</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {programs.map((p) => {
                const c = consumedMap[p.id] ?? 0;
                const pct = p.plannedSessions > 0 ? Math.round((c / p.plannedSessions) * 100) : 0;
                const st = STATUS_MAP[p.status] ?? { label: p.status, variant: "gray" };
                return (
                  <Tr key={p.id}>
                    <Td>
                      <Link href={`/patients/${p.patient.id}`} className="text-primary-600 hover:underline font-medium">
                        {p.patient.fullName}
                      </Link>
                    </Td>
                    <Td>{p.service.name}</Td>
                    <Td>{p.therapist.fullName}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{c}/{p.plannedSessions}</span>
                      </div>
                    </Td>
                    <Td>{format(new Date(p.startDate), "d MMM yyyy", { locale: arSA })}</Td>
                    <Td><Badge variant={st.variant}>{st.label}</Badge></Td>
                    <Td>
                      <Link href={`/programs/${p.id}`} className="text-primary-600 hover:underline text-xs">عرض</Link>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        )}
      </div>

      <Pagination total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
