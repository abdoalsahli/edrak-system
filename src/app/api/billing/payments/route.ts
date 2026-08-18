import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSchema = z.object({
  invoiceId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "INSURANCE"]),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const invoice = await prisma.invoice.findUnique({ where: { id: d.invoiceId } });
  if (!invoice) return badRequest({ message: "الفاتورة غير موجودة" });
  if (invoice.status === "VOID") return badRequest({ message: "لا يمكن إضافة دفع لفاتورة ملغاة" });

  const newPaid = Number(invoice.paidAmount) + d.amount;
  const newStatus =
    newPaid >= Number(invoice.totalAmount) ? "PAID" :
    newPaid > 0 ? "PARTIAL" : "ISSUED";

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        invoiceId: d.invoiceId,
        patientId: invoice.patientId,
        paymentDate: d.paymentDate ? new Date(d.paymentDate) : new Date(),
        amount: d.amount,
        method: d.method,
        referenceNumber: d.referenceNumber ?? null,
        receivedBy: auth.id,
        notes: d.notes ?? null,
      },
    });
    await tx.invoice.update({
      where: { id: d.invoiceId },
      data: { paidAmount: newPaid, status: newStatus },
    });
    return p;
  });

  return ok(payment);
}
