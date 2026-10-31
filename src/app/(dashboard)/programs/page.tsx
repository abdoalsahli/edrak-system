import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";
import { PageHeader } from "@/components/ui/PageHeader";
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
        invoice: { select: { totalAmount: true } },
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

      <div className="mb-5 flex gap-2">
        <form method="get" className="flex flex-1 flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="بحث باسم الحالة..." className="input max-w-xs !rounded-full" />
          <select name="status" defaultValue={statusFilter} className="input max-w-[160px] !rounded-full">
            <option value="">جميع الحالات</option>
            <option value="ACTIVE">نشط</option>
            <option value="COMPLETED">مكتمل</option>
            <option value="EXTENDED">ممتد</option>
            <option value="CANCELLED">ملغي</option>
          </select>
          <button type="submit" className="btn-secondary">بحث</button>
        </form>
      </div>

      {programs.length === 0 ? (
        <div className="card">
          <EmptyState title="لا توجد برامج" action={<Link href="/programs/new" className="btn-primary">+ برنامج جديد</Link>} />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {programs.map((p) => {
            const c = consumedMap[p.id] ?? 0;
            const pct = p.plannedSessions > 0 ? Math.min(100, Math.round((c / p.plannedSessions) * 100)) : 0;
            const st = STATUS_MAP[p.status] ?? { label: p.status, variant: "gray" };
            const value = Number(p.invoice?.totalAmount ?? 0);
            return (
              <Link key={p.id} href={`/programs/${p.id}`} className="card block p-5 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-800">{p.service.name}</p>
                    <p className="truncate text-sm text-gray-500">{p.patient.fullName}</p>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {c} من {p.plannedSessions} جلسة · {p.sessionsPerWeek} أسبوعياً · منذ {format(new Date(p.startDate), "d MMM", { locale: arSA })}
                </p>

                <div className="mt-4 flex items-center justify-between border-t border-gray-300/70 pt-4 text-sm">
                  <span className="text-gray-600">{p.therapist.fullName}</span>
                  <span className="font-semibold text-gray-800">{value.toLocaleString("en-US")} د.ل</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Pagination total={total} pageSize={PAGE_SIZE} />
    </div>
  );
}
