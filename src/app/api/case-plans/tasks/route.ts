import { NextResponse } from "next/server";
import { ok, requireAuth, therapistIdOf } from "@/lib/api";
import { getCaseTasks, getReviewQueue } from "@/lib/casePlans/CycleService";

/**
 * What is waiting: a therapist sees their own plans and reports to write; the
 * manager sees everyone's, plus what has been sent for review.
 */
export async function GET() {
  const auth = await requireAuth(["MANAGER", "THERAPIST"]);
  if (auth instanceof NextResponse) return auth;

  if (auth.role === "THERAPIST") {
    const therapistId = await therapistIdOf(auth.id);
    return ok({ tasks: therapistId ? await getCaseTasks(therapistId) : [], reviews: [] });
  }
  const [tasks, reviews] = await Promise.all([getCaseTasks(), getReviewQueue()]);
  return ok({ tasks, reviews });
}
