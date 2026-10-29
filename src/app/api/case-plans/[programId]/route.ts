import { NextResponse } from "next/server";
import { ok, notFound } from "@/lib/api";
import { requireProgramAccess } from "@/lib/casePlans/access";
import { getProgramCycles } from "@/lib/casePlans/CycleService";

/** The cycles of a program, each with its plan and report status. */
export async function GET(_req: Request, { params }: { params: { programId: string } }) {
  const access = await requireProgramAccess(params.programId);
  if (access instanceof NextResponse) return access;
  const data = await getProgramCycles(params.programId);
  if (!data) return notFound("البرنامج غير موجود");
  const { program, cycles } = data;
  return ok({
    program: {
      id: program.id, status: program.status, sessionsPerWeek: program.sessionsPerWeek,
      patient: program.patient, therapist: program.therapist, service: program.service,
    },
    cycles,
  });
}
