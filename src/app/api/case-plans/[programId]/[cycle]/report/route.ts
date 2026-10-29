import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest } from "@/lib/api";
import { requireProgramAccess } from "@/lib/casePlans/access";
import { getCycle } from "@/lib/casePlans/CycleService";

const ReportSchema = z.object({
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ التقرير غير صالح"),
  diagnosis: z.string().trim(),
  progressLevel: z.string().trim(),
  changes: z.array(z.string().trim().min(1)).max(20),
  parentCommitment: z.string().trim(),
  obstacles: z.array(z.string().trim().min(1)).max(20),
  recommendations: z.string().trim(),
  goalResults: z.array(z.object({ goalId: z.string(), achievement: z.enum(["ACHIEVED", "PARTIAL", "NOT_ACHIEVED"]).nullable() })),
  submit: z.boolean().default(false),
});

/** Write (or rewrite) the follow-up report of a cycle — against its plan. */
export async function PUT(req: Request, { params }: { params: { programId: string; cycle: string } }) {
  const access = await requireProgramAccess(params.programId);
  if (access instanceof NextResponse) return access;
  const n = Number(params.cycle);
  const data = await getCycle(params.programId, n);
  if (!data) return notFound("الدورة غير موجودة");

  const plan = await prisma.treatmentPlan.findUnique({
    where: { programId_cycleNumber: { programId: data.program.id, cycleNumber: n } },
    include: { goals: true, report: true },
  });
  if (!plan) return badRequest({ message: "لا توجد خطة لهذه الدورة — اكتب الخطة أولاً" });
  if (plan.status === "DRAFT") return badRequest({ message: "أرسل خطة الدورة أولاً، ثم اكتب تقرير المتابعة" });
  if (plan.report?.status === "APPROVED") return badRequest({ message: "التقرير معتمد — لا يمكن تعديله" });

  const parsed = ReportSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const results = new Map(d.goalResults.filter((r) => plan.goals.some((g) => g.id === r.goalId)).map((r) => [r.goalId, r.achievement]));

  if (d.submit) {
    if (!data.cycle.ended) return badRequest({ message: "لا تزال في هذه الدورة جلسات مجدولة — يُرسل التقرير بعد آخر جلسة" });
    const missing = [
      !d.diagnosis && "التشخيص",
      plan.goals.some((g) => !results.get(g.id)) && "تقييم كل هدف",
      !d.progressLevel && "مستوى التقدّم",
      d.changes.length === 0 && "التغيرات الملحوظة",
      !d.parentCommitment && "تنفيذ الأهل للتعليمات",
      d.obstacles.length === 0 && "معوّقات التقدّم",
      !d.recommendations && "التوصيات",
    ].filter(Boolean);
    if (missing.length) return badRequest({ message: `أكمل قبل الإرسال: ${missing.join("، ")}` });
  }

  const existing = plan.report;
  const status = d.submit ? "SUBMITTED" : existing?.status === "RETURNED" ? "RETURNED" : "DRAFT";
  const fields = {
    reportDate: new Date(d.reportDate),
    diagnosis: d.diagnosis,
    progressLevel: d.progressLevel,
    changes: d.changes,
    parentCommitment: d.parentCommitment,
    obstacles: d.obstacles,
    recommendations: d.recommendations,
    status,
    ...(d.submit ? { submittedAt: new Date() } : {}),
  } as const;

  const report = await prisma.$transaction(async (tx) => {
    for (const g of plan.goals) {
      await tx.planGoal.update({ where: { id: g.id }, data: { achievement: results.get(g.id) ?? null } });
    }
    return existing
      ? tx.followUpReport.update({ where: { id: existing.id }, data: fields })
      : tx.followUpReport.create({
          data: { ...fields, planId: plan.id, therapistId: plan.therapistId, createdById: access.auth.id },
        });
  });
  return ok({ id: report.id, status: report.status });
}
