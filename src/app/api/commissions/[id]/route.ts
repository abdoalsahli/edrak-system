import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const commission = await prisma.therapistCommission.findUnique({
    where: { id: params.id },
  });
  if (!commission) return notFound();
  if (commission.isPaid) return badRequest("هذه العمولة مدفوعة بالفعل");

  const body = await req.json();

  if (body.action === "pay") {
    const updated = await prisma.therapistCommission.update({
      where: { id: params.id },
      data: { isPaid: true, paidAt: new Date(), paidBy: auth.id, notes: body.notes ?? null },
    });
    return ok(updated);
  }

  return badRequest("action غير معروف");
}
