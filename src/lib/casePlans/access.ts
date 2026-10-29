import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, therapistIdOf, forbidden, notFound, type AuthResult } from "@/lib/api";

/**
 * Who may open a program's plans and reports: the manager (all programs, and
 * writes for therapists who have no login), and the program's own therapist.
 */
export async function requireProgramAccess(programId: string): Promise<{ auth: AuthResult } | NextResponse> {
  const auth = await requireAuth(["MANAGER", "THERAPIST"]);
  if (auth instanceof NextResponse) return auth;
  const program = await prisma.program.findUnique({ where: { id: programId }, select: { therapistId: true } });
  if (!program) return notFound("البرنامج غير موجود");
  if (auth.role === "THERAPIST" && (await therapistIdOf(auth.id)) !== program.therapistId) return forbidden();
  return { auth };
}
