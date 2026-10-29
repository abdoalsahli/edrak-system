import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { TasksBoard } from "@/components/casePlans/TasksBoard";

/** الخطط والتقارير — management's review queue and what therapists still owe. */
export default async function CasePlansPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "MANAGER") redirect("/dashboard");

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="الخطط والتقارير"
        description="خطة علاجية في بداية كل دورة (12 جلسة) وتقرير متابعة في نهايتها — تراجعها الإدارة"
      />
      <TasksBoard mode="manager" />
    </div>
  );
}
