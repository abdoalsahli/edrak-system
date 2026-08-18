import { NextResponse } from "next/server";
import { requireAuth, badRequest } from "@/lib/api";
import { generateProgramSchedule } from "@/lib/scheduling/SchedulingService";
import { z } from "zod";

const Schema = z.object({
  patientId: z.string(),
  therapistId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalSessions: z.number().int().min(1),
  sessionsPerWeek: z.number().int().min(1).max(7),
  durationMin: z.number().int().min(15).default(60),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
});

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  const result = await generateProgramSchedule(parsed.data);
  return NextResponse.json(result);
}
