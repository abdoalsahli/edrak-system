import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createReceipt, getPatientAccountId, LedgerError } from "@/lib/ledger/LedgerService";
import { z } from "zod";

/**
 * سند قبض — posted to a CURRENT ACCOUNT, never to an invoice.
 *
 * Give the account directly, or (for older screens) an invoice, in which case
 * the receipt goes to that invoice's patient account. Refunds are no longer
 * negative receipts: pay them back with a سند صرف from the patient account.
 */
const CreateSchema = z
  .object({
    accountId: z.string().optional(),
    invoiceId: z.string().optional(),
    amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
    paymentMethodId: z.string({ required_error: "اختر طريقة الدفع" }),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    referenceNumber: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => d.accountId || d.invoiceId, { message: "حدّد الحساب", path: ["accountId"] });

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  try {
    const payment = await prisma.$transaction(async (tx) => {
      let accountId = d.accountId;
      if (!accountId && d.invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: d.invoiceId }, select: { patientId: true } });
        if (!inv) throw new LedgerError("الفاتورة غير موجودة");
        accountId = await getPatientAccountId(tx, inv.patientId);
      }
      return createReceipt(tx, {
        accountId: accountId!,
        amount: d.amount,
        paymentMethodId: d.paymentMethodId,
        paymentDate: d.paymentDate ? new Date(d.paymentDate) : undefined,
        referenceNumber: d.referenceNumber,
        notes: d.notes,
        receivedBy: auth.id,
      });
    });
    return ok(payment, 201);
  } catch (e) {
    if (e instanceof LedgerError) return badRequest({ message: e.message });
    throw e;
  }
}
