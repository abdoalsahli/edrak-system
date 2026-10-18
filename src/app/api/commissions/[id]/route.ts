import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, notFound } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createDisbursement, getTherapistAccountId, LedgerError } from "@/lib/ledger/LedgerService";
import { z } from "zod";

const PaySchema = z.object({
  action: z.literal("pay"),
  paymentMethodId: z.string({ required_error: "اختر طريقة الدفع" }),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Pay one commission: a سند صرف that debits the therapist's current account for
 * its amount, with the row marked paid. Free-amount payouts and advances go
 * through the therapist's account page instead.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const commission = await prisma.therapistCommission.findUnique({
    where: { id: params.id },
    include: { therapist: { select: { fullName: true } } },
  });
  if (!commission) return notFound();
  if (commission.isPaid) return badRequest({ message: "هذه العمولة مدفوعة بالفعل" });
  if (!commission.isEarned) {
    return badRequest({ message: "لا يمكن صرف عمولة جلسة لم تُقدَّم بعد — يمكن صرف سُلفة من حساب الأخصائي" });
  }

  const body = await req.json();
  if (body.action !== "pay") return badRequest({ message: "action غير معروف" });

  const parsed = PaySchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const payDate = d.paymentDate ? new Date(d.paymentDate) : new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const disbursement = await createDisbursement(tx, {
        accountId: await getTherapistAccountId(tx, commission.therapistId),
        type: "COMMISSION",
        amount: Number(commission.amount),
        paymentMethodId: d.paymentMethodId,
        paymentDate: payDate,
        description: `صرف عمولة — ${commission.therapist.fullName}`,
        referenceNumber: d.referenceNumber,
        notes: d.notes,
        issuedBy: auth.id,
      });

      const updated = await tx.therapistCommission.update({
        where: { id: params.id },
        data: { isPaid: true, paidAt: payDate, paidBy: auth.id, disbursementId: disbursement.id, notes: d.notes ?? null },
      });

      return { commission: updated, voucherNumber: disbursement.voucherNumber };
    });
    return ok(result);
  } catch (e) {
    if (e instanceof LedgerError) return badRequest({ message: e.message });
    throw e;
  }
}
