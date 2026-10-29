import { NextResponse } from "next/server";
import { requireAuth, badRequest } from "@/lib/api";
import { generateProgramSchedule } from "@/lib/scheduling/SchedulingService";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/** Arabic count of days: يوماً واحداً / يومين / 3 أيام / 11 يوماً */
const daysAr = (n: number) => (n === 1 ? "يوماً واحداً" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوماً`);

const Schema = z.object({
  patientId: z.string(),
  therapistId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalSessions: z.number().int().min(1),
  sessionsPerWeek: z.number().int().min(1).max(7),
  durationMin: z.number().int().min(15).default(60),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/).default("15:00"),
  allowedDays: z.array(z.number().int().min(0).max(6)).optional(),
  // Rescheduling this programme: its remaining appointments are being moved
  rescheduleProgramId: z.string().optional(),
}).refine(
  // When days are chosen they must match the weekly rhythm exactly (3/week → 3 days)
  (d) => !d.allowedDays?.length || new Set(d.allowedDays).size === d.sessionsPerWeek,
  (d) => ({ message: `اختر ${daysAr(d.sessionsPerWeek)} بعدد الجلسات الأسبوعية`, path: ["allowedDays"] })
);

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  const { rescheduleProgramId, ...config } = parsed.data;
  const excludeAppointmentIds = rescheduleProgramId
    ? (await prisma.appointment.findMany({
        where: { status: "SCHEDULED", deletedAt: null, session: { programId: rescheduleProgramId, status: "PENDING" } },
        select: { id: true },
      })).map((a) => a.id)
    : undefined;

  const result = await generateProgramSchedule({ ...config, excludeAppointmentIds });
  return NextResponse.json(result);
}
