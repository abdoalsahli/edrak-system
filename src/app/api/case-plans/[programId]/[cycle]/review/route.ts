import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, notFound, badRequest, requireAuth } from "@/lib/api";

const ReviewSchema = z.object({
  doc: z.enum(["plan", "report"]),
  decision: z.enum(["APPROVE", "RETURN"]),
  note: z.string().trim().nullish(),
});

/** Management review: approve a sent plan or report, or send it back with a note. */
export async function POST(req: Request, { params }: { params: { programId: string; cycle: string } }) {
  const auth = await requireAuth(["MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = ReviewSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  if (d.decision === "RETURN" && !d.note) return badRequest({ message: "اكتب ملاحظة توضّح المطلوب تعديله" });

  const plan = await prisma.treatmentPlan.findUnique({
    where: { programId_cycleNumber: { programId: params.programId, cycleNumber: Number(params.cycle) } },
    include: { report: true },
  });
  const target = d.doc === "plan" ? plan : plan?.report;
  if (!target) return notFound(d.doc === "plan" ? "الخطة غير موجودة" : "التقرير غير موجود");
  if (target.status !== "SUBMITTED") return badRequest({ message: "لم يُرسل للمراجعة" });

  const review = {
    status: d.decision === "APPROVE" ? ("APPROVED" as const) : ("RETURNED" as const),
    reviewNote: d.note || null,
    reviewedById: auth.id,
    reviewedAt: new Date(),
  };
  if (d.doc === "plan") await prisma.treatmentPlan.update({ where: { id: target.id }, data: review });
  else await prisma.followUpReport.update({ where: { id: target.id }, data: review });
  return ok({ status: review.status });
}
