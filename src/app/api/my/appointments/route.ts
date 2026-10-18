import { NextResponse } from "next/server";
import { requireAuth, therapistIdOf, badRequest, forbidden } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * جدولي — the signed-in therapist's own appointments in a date range.
 * Clinical fields only: no prices, invoices or commissions.
 */
export async function GET(req: Request) {
  const auth = await requireAuth(["THERAPIST"]);
  if (auth instanceof NextResponse) return auth;
  const therapistId = await therapistIdOf(auth.id);
  if (!therapistId) return forbidden();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return badRequest({ message: "حدّد الفترة (from, to)" });
  }

  const rows = await prisma.appointment.findMany({
    where: {
      therapistId,
      date: { gte: new Date(from), lte: new Date(to) },
      deletedAt: null,
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      status: true,
      session: {
        select: {
          id: true,
          status: true,
          isCharged: true,
          outcomeNotes: true,
          programSequenceNumber: true,
          patient: { select: { fullName: true, patientType: true } },
          service: { select: { name: true } },
          program: { select: { plannedSessions: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ data: rows });
}
