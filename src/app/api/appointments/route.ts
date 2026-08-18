import { NextResponse } from "next/server";
import { requireAuth, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      date: { gte: new Date(from), lte: new Date(to) },
      deletedAt: null,
      status: { not: "CANCELLED" },
    },
    include: {
      session: {
        include: {
          patient: { select: { id: true, fullName: true } },
          service: { select: { name: true } },
          program: { select: { id: true } },
        },
      },
      therapist: { select: { id: true, fullName: true } },
      room: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return ok(appointments);
}
