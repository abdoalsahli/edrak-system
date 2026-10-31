import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { therapistIdOf } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { TasksBoard } from "@/components/casePlans/TasksBoard";
import { CycleList } from "@/components/casePlans/CycleList";

/** خططي وتقاريري — the therapist's plans and follow-up reports, program by program. */
export default async function MyPlansPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const therapistId = await therapistIdOf(session.user.id);

  const programs = therapistId
    ? await prisma.program.findMany({
        where: { therapistId, status: { in: ["ACTIVE", "EXTENDED"] } },
        include: { patient: { select: { fullName: true } }, service: { select: { name: true } } },
        orderBy: { startDate: "desc" },
      })
    : [];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="خططي وتقاريري"
        description="اكتب خطة علاجية في بداية كل شهر (12 جلسة)، وتقرير متابعة في نهايتها يُرفع للإدارة"
      />
      <TasksBoard mode="therapist" />

      <h2 className="mb-4 mt-8 text-lg font-semibold text-gray-800">برامجي الجارية</h2>
      {programs.length === 0 ? (
        <p className="card p-6 text-center text-sm text-gray-400">لا توجد برامج جارية.</p>
      ) : (
        <div className="space-y-5">
          {programs.map((p) => (
            <CycleList
              key={p.id}
              programId={p.id}
              basePath={`/my/plans/${p.id}`}
              title={<>{p.patient.fullName} <span className="text-sm font-normal text-gray-400">· {p.service.name}</span></>}
            />
          ))}
        </div>
      )}
    </div>
  );
}
