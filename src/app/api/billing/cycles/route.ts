import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addMonths, endOfMonth, format } from "date-fns";

const CreateSchema = z.object({
  programId: z.string(),
  cycleType: z.enum(["MONTHLY", "PER_N_SESSIONS"]),
  cycleValue: z.number().int().min(1).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const programId = searchParams.get("programId");
  const { skip, take } = paginate(searchParams);

  const [cycles, total] = await Promise.all([
    prisma.billingCycle.findMany({
      where: programId ? { programId } : {},
      include: {
        program: {
          include: {
            patient: { select: { fullName: true } },
            service: { select: { name: true } },
          },
        },
        invoices: { select: { id: true, status: true, totalAmount: true, paidAmount: true } },
      },
      orderBy: { periodStart: "desc" },
      skip,
      take,
    }),
    prisma.billingCycle.count({ where: programId ? { programId } : {} }),
  ]);

  return NextResponse.json({ data: cycles, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const program = await prisma.program.findUnique({ where: { id: d.programId } });
  if (!program) return badRequest({ message: "البرنامج غير موجود" });

  const periodStart = new Date(d.periodStart);
  let periodEnd: Date;

  if (d.cycleType === "MONTHLY") {
    periodEnd = endOfMonth(periodStart);
  } else {
    // PER_N_SESSIONS: end is computed after sessions are consumed — start with null-like placeholder
    periodEnd = addMonths(periodStart, 1);
  }

  // Count the previous cycles to determine cycle number
  const prevCount = await prisma.billingCycle.count({ where: { programId: d.programId } });

  // Calculate expected sessions for this period
  let expectedSessions = 0;
  if (d.cycleType === "MONTHLY") {
    const sessionsInPeriod = await prisma.session.count({
      where: {
        programId: d.programId,
        appointments: {
          some: {
            date: { gte: periodStart, lte: periodEnd },
            status: { not: "CANCELLED" },
            deletedAt: null,
          },
        },
      },
    });
    expectedSessions = sessionsInPeriod;
  } else {
    expectedSessions = d.cycleValue ?? 1;
  }

  const cycle = await prisma.billingCycle.create({
    data: {
      programId: d.programId,
      cycleNumber: prevCount + 1,
      cycleType: d.cycleType,
      cycleValue: d.cycleValue ?? 1,
      periodStart,
      periodEnd,
      expectedSessions,
      status: "OPEN",
    },
  });

  return ok(cycle);
}
