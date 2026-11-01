import type { ProgramStatus, SessionStatus } from "@/lib/enums";
import { prisma } from "@/lib/prisma";
import { cycleSize, type DocStatus } from "./options";

/**
 * Cycles of a program, shown to people as months («الشهر الأول»). Sessions are split by their sequence number
 * into blocks of sessionsPerWeek × 4. A plan fixes the range of its cycle when
 * it is written; cycles without a plan follow on with the program's rhythm.
 *
 *   cycle 1: sessions 1–12   plan → sessions → follow-up report → review
 *   cycle 2: sessions 13–24  plan (copied or new) → …
 *
 * Once the last cycle's report has been sent and the program is still running,
 * the next cycle appears (without sessions yet) so its plan can be written
 * before the program is extended.
 */

export type CycleSummary = {
  number: number;
  fromSequence: number;
  toSequence: number;
  /** Sessions of the cycle that exist (an upcoming cycle has none yet) */
  sessions: { total: number; completed: number; absent: number; cancelled: number; pending: number };
  firstDate: string | null;
  lastDate: string | null;
  started: boolean;
  /** No session of the cycle is still scheduled */
  ended: boolean;
  /** Ended and at least one session was held — a follow-up report is expected */
  reportExpected: boolean;
  plan: { id: string; status: DocStatus; goals: number } | null;
  report: { id: string; status: DocStatus } | null;
};

const ACTIVE: ProgramStatus[] = ["ACTIVE", "EXTENDED"];
const CANCELLED: SessionStatus[] = ["CANCELLED_BY_PATIENT", "CANCELLED_BY_CENTER"];

const programInclude = {
  sessions: {
    where: { programSequenceNumber: { not: null } },
    select: {
      programSequenceNumber: true,
      status: true,
      appointments: { where: { status: { not: "CANCELLED" as const } }, select: { date: true }, take: 1 },
    },
  },
  plans: {
    orderBy: { cycleNumber: "asc" as const },
    select: {
      id: true, cycleNumber: true, fromSequence: true, toSequence: true, status: true,
      _count: { select: { goals: true } },
      report: { select: { id: true, status: true } },
    },
  },
} as const;

type ProgramForCycles = {
  status: ProgramStatus | string;
  sessionsPerWeek: number;
  sessions: { programSequenceNumber: number | null; status: SessionStatus | string; appointments: { date: Date }[] }[];
  plans: {
    id: string; cycleNumber: number; fromSequence: number; toSequence: number; status: DocStatus | string;
    _count: { goals: number };
    report: { id: string; status: DocStatus | string } | null;
  }[];
};

/** Split a loaded program into its cycles. */
export function buildCycles(program: ProgramForCycles, now = new Date()): CycleSummary[] {
  const size = cycleSize(program.sessionsPerWeek);
  const bySeq = new Map(program.sessions.map((s) => [s.programSequenceNumber!, s]));
  const maxSeq = Math.max(0, ...bySeq.keys());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const cycles: CycleSummary[] = [];
  let from = 1;
  for (let n = 1; from <= maxSeq || program.plans.some((p) => p.cycleNumber >= n); n++) {
    const plan = program.plans.find((p) => p.cycleNumber === n);
    const to = plan ? plan.toSequence : from + size - 1;
    cycles.push(summarise(n, plan?.fromSequence ?? from, to));
    from = to + 1;
  }

  // The cycle after a reported one, while the program still runs
  const last = cycles[cycles.length - 1];
  if (
    ACTIVE.includes(program.status as ProgramStatus) &&
    (!last || (last.ended && last.report && last.report.status !== "DRAFT"))
  ) {
    if (last || maxSeq === 0) cycles.push(summarise(cycles.length + 1, from, from + size - 1));
  }
  return cycles;

  function summarise(number: number, fromSequence: number, toSequence: number): CycleSummary {
    const list: ProgramForCycles["sessions"] = [];
    for (let q = fromSequence; q <= toSequence; q++) {
      const s = bySeq.get(q);
      if (s) list.push(s);
    }
    const count = (f: (st: SessionStatus) => boolean) => list.filter((s) => f(s.status as SessionStatus)).length;
    const dates = list.map((s) => s.appointments[0]?.date).filter((d): d is Date => !!d).sort((a, b) => +a - +b);
    const sessions = {
      total: list.length,
      completed: count((s) => s === "COMPLETED"),
      absent: count((s) => s === "ABSENT"),
      cancelled: count((s) => CANCELLED.includes(s)),
      pending: count((s) => s === "PENDING"),
    };
    const ended = sessions.total > 0 && sessions.pending === 0;
    const plan = program.plans.find((p) => p.cycleNumber === number);
    return {
      number, fromSequence, toSequence, sessions,
      firstDate: dates[0]?.toISOString() ?? null,
      lastDate: dates[dates.length - 1]?.toISOString() ?? null,
      started: sessions.completed + sessions.absent > 0 || (!!dates[0] && dates[0] <= today),
      ended,
      reportExpected: ended && sessions.completed + sessions.absent > 0,
      plan: plan ? { id: plan.id, status: plan.status as DocStatus, goals: plan._count.goals } : null,
      report: plan?.report ? { id: plan.report.id, status: plan.report.status as DocStatus } : null,
    };
  }
}

export async function getProgramCycles(programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      ...programInclude,
      patient: { select: { id: true, fullName: true, patientType: true } },
      therapist: { select: { id: true, fullName: true } },
      service: { select: { name: true } },
    },
  });
  if (!program) return null;
  return { program, cycles: buildCycles(program) };
}

/** One cycle of a program (null when the program or the cycle does not exist). */
export async function getCycle(programId: string, number: number) {
  const data = await getProgramCycles(programId);
  const cycle = data?.cycles.find((c) => c.number === number);
  return data && cycle ? { ...data, cycle } : null;
}

// ─── Tasks & review queue ────────────────────────────────────────────────────

export type CaseTask = {
  kind: "PLAN_MISSING" | "PLAN_DRAFT" | "PLAN_RETURNED" | "REPORT_DUE" | "REPORT_DRAFT" | "REPORT_RETURNED";
  programId: string;
  cycle: number;
  patientName: string;
  therapistName: string;
  serviceName: string;
  /** The cycle has started without a plan, or ended without a report */
  late: boolean;
  firstDate: string | null;
  lastDate: string | null;
};

export type ReviewItem = {
  doc: "plan" | "report";
  programId: string;
  cycle: number;
  patientName: string;
  therapistName: string;
  submittedAt: string | null;
};

/**
 * What still needs writing, for one therapist or for everyone. Programs that
 * ended long ago are not chased: a missing plan only counts for a cycle that
 * has not ended, so cases from before this feature do not flood the list.
 */
export async function getCaseTasks(therapistId?: string): Promise<CaseTask[]> {
  const programs = await prisma.program.findMany({
    where: {
      ...(therapistId ? { therapistId } : {}),
      OR: [
        { status: { in: ACTIVE } },
        // A finished program may still owe the report of its last cycle
        { status: "COMPLETED", plans: { some: { OR: [{ report: null }, { report: { status: { in: ["DRAFT", "RETURNED"] } } }] } } },
      ],
    },
    include: {
      ...programInclude,
      patient: { select: { fullName: true } },
      therapist: { select: { fullName: true } },
      service: { select: { name: true } },
    },
  });

  const tasks: CaseTask[] = [];
  for (const p of programs) {
    const base = {
      programId: p.id, patientName: p.patient.fullName, therapistName: p.therapist.fullName, serviceName: p.service.name,
    };
    for (const c of buildCycles(p)) {
      const at = { ...base, cycle: c.number, firstDate: c.firstDate, lastDate: c.lastDate };
      if (!c.plan) {
        const allCancelled = c.sessions.total > 0 && c.sessions.cancelled === c.sessions.total;
        if (!c.ended && !allCancelled && ACTIVE.includes(p.status as ProgramStatus)) tasks.push({ ...at, kind: "PLAN_MISSING", late: c.started });
        continue;
      }
      if (c.plan.status === "DRAFT") tasks.push({ ...at, kind: "PLAN_DRAFT", late: c.started });
      if (c.plan.status === "RETURNED") tasks.push({ ...at, kind: "PLAN_RETURNED", late: c.started });
      if (c.reportExpected) {
        if (!c.report) tasks.push({ ...at, kind: "REPORT_DUE", late: true });
        else if (c.report.status === "DRAFT") tasks.push({ ...at, kind: "REPORT_DRAFT", late: true });
        else if (c.report.status === "RETURNED") tasks.push({ ...at, kind: "REPORT_RETURNED", late: true });
      }
    }
  }
  const order: CaseTask["kind"][] = ["PLAN_RETURNED", "REPORT_RETURNED", "REPORT_DUE", "REPORT_DRAFT", "PLAN_MISSING", "PLAN_DRAFT"];
  return tasks.sort((a, b) => Number(b.late) - Number(a.late) || order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** Plans and reports sent to management and not reviewed yet. */
export async function getReviewQueue(): Promise<ReviewItem[]> {
  const [plans, reports] = await Promise.all([
    prisma.treatmentPlan.findMany({
      where: { status: "SUBMITTED" },
      include: { program: { select: { patient: { select: { fullName: true } } } }, therapist: { select: { fullName: true } } },
    }),
    prisma.followUpReport.findMany({
      where: { status: "SUBMITTED" },
      include: {
        plan: { select: { programId: true, cycleNumber: true, program: { select: { patient: { select: { fullName: true } } } } } },
        therapist: { select: { fullName: true } },
      },
    }),
  ]);
  return [
    ...plans.map((p): ReviewItem => ({
      doc: "plan", programId: p.programId, cycle: p.cycleNumber,
      patientName: p.program.patient.fullName, therapistName: p.therapist.fullName,
      submittedAt: p.submittedAt?.toISOString() ?? null,
    })),
    ...reports.map((r): ReviewItem => ({
      doc: "report", programId: r.plan.programId, cycle: r.plan.cycleNumber,
      patientName: r.plan.program.patient.fullName, therapistName: r.therapist.fullName,
      submittedAt: r.submittedAt?.toISOString() ?? null,
    })),
  ].sort((a, b) => (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
}
