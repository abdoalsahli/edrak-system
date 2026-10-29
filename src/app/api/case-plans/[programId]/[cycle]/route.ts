import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound } from "@/lib/api";
import { requireProgramAccess } from "@/lib/casePlans/access";
import { getCycle } from "@/lib/casePlans/CycleService";

const planInclude = {
  goals: { orderBy: { sortOrder: "asc" as const } },
  reviewedBy: { select: { name: true } },
  report: { include: { reviewedBy: { select: { name: true } } } },
};

/**
 * One cycle: its plan and report, the sessions it covers, and what the
 * previous cycle left (its plan to copy, its recommendations and diagnosis).
 */
export async function GET(_req: Request, { params }: { params: { programId: string; cycle: string } }) {
  const access = await requireProgramAccess(params.programId);
  if (access instanceof NextResponse) return access;
  const n = Number(params.cycle);
  const data = await getCycle(params.programId, n);
  if (!data) return notFound("الدورة غير موجودة");
  const { program, cycle } = data;

  const [plan, previous, sessions] = await Promise.all([
    prisma.treatmentPlan.findUnique({ where: { programId_cycleNumber: { programId: program.id, cycleNumber: n } }, include: planInclude }),
    // The latest earlier plan — usually the previous cycle's
    prisma.treatmentPlan.findFirst({
      where: { programId: program.id, cycleNumber: { lt: n } },
      orderBy: { cycleNumber: "desc" },
      include: { goals: { orderBy: { sortOrder: "asc" } }, report: { select: { recommendations: true, diagnosis: true } } },
    }),
    prisma.session.findMany({
      where: { programId: program.id, programSequenceNumber: { gte: cycle.fromSequence, lte: cycle.toSequence } },
      orderBy: { programSequenceNumber: "asc" },
      select: {
        id: true, programSequenceNumber: true, status: true, outcomeNotes: true,
        appointments: { where: { status: { not: "CANCELLED" } }, select: { date: true, startTime: true }, take: 1 },
      },
    }),
  ]);

  const role = access.auth.role;
  const report = plan?.report ?? null;
  return ok({
    program: {
      id: program.id, status: program.status,
      patient: program.patient, therapist: program.therapist, service: program.service,
    },
    cycle,
    cycleCount: data.cycles.length,
    plan,
    report,
    previous: previous
      ? {
          cycleNumber: previous.cycleNumber,
          plan: {
            caseSummary: previous.caseSummary, longTermGoals: previous.longTermGoals, methods: previous.methods,
            focusAreas: previous.focusAreas, notes: previous.notes, goals: previous.goals.map((g) => g.text),
          },
          recommendations: previous.report?.recommendations ?? null,
          diagnosis: previous.report?.diagnosis ?? null,
        }
      : null,
    sessions: sessions.map((s) => ({
      id: s.id, sequence: s.programSequenceNumber, status: s.status, notes: s.outcomeNotes,
      date: s.appointments[0]?.date ?? null, startTime: s.appointments[0]?.startTime ?? null,
    })),
    // A plan can change until it is approved or its report has started; a report until it is approved
    canEditPlan: !report && plan?.status !== "APPROVED",
    canEditReport: !!plan && plan.status !== "DRAFT" && report?.status !== "APPROVED",
    canReview: role === "MANAGER",
  });
}
