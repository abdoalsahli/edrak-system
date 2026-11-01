import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest } from "@/lib/api";
import { requireProgramAccess } from "@/lib/casePlans/access";
import { getCycle } from "@/lib/casePlans/CycleService";
import { toJson } from "@/lib/json";

const PlanSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الخطة غير صالح"),
  caseSummary: z.string().trim(),
  longTermGoals: z.string().trim(),
  methods: z.string().trim(),
  focusAreas: z.array(z.string().trim().min(1)).max(20),
  notes: z.string().trim().nullish(),
  goals: z.array(z.string().trim()).max(50),
  // false = save as draft, true = send to management
  submit: z.boolean().default(false),
});

/** Write (or rewrite) the treatment plan of a cycle. */
export async function PUT(req: Request, { params }: { params: { programId: string; cycle: string } }) {
  const access = await requireProgramAccess(params.programId);
  if (access instanceof NextResponse) return access;
  const n = Number(params.cycle);
  const data = await getCycle(params.programId, n);
  if (!data) return notFound("الشهر غير موجود");

  const parsed = PlanSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const goals = d.goals.filter(Boolean);

  const existing = await prisma.treatmentPlan.findUnique({
    where: { programId_cycleNumber: { programId: data.program.id, cycleNumber: n } },
    include: { report: { select: { id: true } } },
  });
  if (existing?.report) return badRequest({ message: "بدأ تقرير المتابعة لهذا الشهر — لا يمكن تعديل خطته" });
  if (existing?.status === "APPROVED") return badRequest({ message: "الخطة معتمدة — لا يمكن تعديلها" });

  if (d.submit) {
    const missing = [
      !d.caseSummary && "ملخص الحالة",
      !d.longTermGoals && "الأهداف طويلة المدى",
      goals.length === 0 && "الأهداف قصيرة المدى",
      !d.methods && "الأساليب والاستراتيجيات",
      d.focusAreas.length === 0 && "الجوانب النمائية",
    ].filter(Boolean);
    if (missing.length) return badRequest({ message: `أكمل قبل الإرسال: ${missing.join("، ")}` });
  }

  // Saving a returned plan as a draft keeps it «returned» until it is sent again
  const status = d.submit ? "SUBMITTED" : existing?.status === "RETURNED" ? "RETURNED" : "DRAFT";
  const fields = {
    planDate: new Date(d.planDate),
    caseSummary: d.caseSummary,
    longTermGoals: d.longTermGoals,
    methods: d.methods,
    focusAreas: toJson(d.focusAreas),
    notes: d.notes || null,
    status,
    ...(d.submit ? { submittedAt: new Date() } : {}),
  } as const;

  const plan = await prisma.$transaction(async (tx) => {
    const p = existing
      ? await tx.treatmentPlan.update({ where: { id: existing.id }, data: fields })
      : await tx.treatmentPlan.create({
          data: {
            ...fields,
            programId: data.program.id,
            cycleNumber: n,
            fromSequence: data.cycle.fromSequence,
            toSequence: data.cycle.toSequence,
            therapistId: data.program.therapist.id,
            createdById: access.auth.id,
          },
        });
    await tx.planGoal.deleteMany({ where: { planId: p.id } });
    if (goals.length) {
      await tx.planGoal.createMany({ data: goals.map((text, i) => ({ planId: p.id, text, sortOrder: i })) });
    }
    return p;
  });
  return ok({ id: plan.id, status: plan.status });
}
