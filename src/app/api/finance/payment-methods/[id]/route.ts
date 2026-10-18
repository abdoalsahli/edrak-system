import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().trim().min(1, "اسم طريقة الدفع مطلوب").optional(),
  cashAccountId: z.string().min(1, "اختر الصندوق").optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * Re-linking a method to another box affects new documents only: every posted
 * document keeps the box it was recorded in.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const method = await prisma.paymentMethod.findUnique({ where: { id: params.id } });
  if (!method) return notFound();

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  if (d.cashAccountId) {
    const box = await prisma.cashAccount.findUnique({ where: { id: d.cashAccountId }, select: { isActive: true } });
    if (!box) return badRequest({ message: "الصندوق غير موجود" });
    if (!box.isActive) return badRequest({ message: "لا يمكن الربط بصندوق معطّل" });
  }
  if (d.name && d.name !== method.name && (await prisma.paymentMethod.findUnique({ where: { name: d.name } }))) {
    return badRequest({ message: `طريقة الدفع «${d.name}» موجودة بالفعل` });
  }

  const updated = await prisma.paymentMethod.update({ where: { id: params.id }, data: d });
  return ok(updated);
}

/** A method that appears on any document can only be disabled, never deleted. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const method = await prisma.paymentMethod.findUnique({
    where: { id: params.id },
    include: { _count: { select: { payments: true, disbursements: true } } },
  });
  if (!method) return notFound();
  if (method._count.payments + method._count.disbursements > 0) {
    return badRequest({ message: "طريقة الدفع مستخدمة في مستندات — يمكنك تعطيلها بدلاً من حذفها" });
  }

  await prisma.paymentMethod.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
