import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  createDisbursement,
  getExpenseAccountId,
  getPatientAccountId,
  getTherapistAccountId,
  LedgerError,
} from "@/lib/ledger/LedgerService";
import { round2 } from "@/lib/billing/InvoiceService";
import { z } from "zod";

const CreateSchema = z.object({
  type: z.enum(["COMMISSION", "REFUND", "EXPENSE", "SALARY", "OTHER"]),
  // The current account debited. When omitted it is derived from the counterparty.
  accountId: z.string().optional(),
  paymentMethodId: z.string({ required_error: "اختر طريقة الدفع" }),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  therapistId: z.string().optional(),
  patientId: z.string().optional(),
  expenseCategory: z
    .enum(["RENT", "SALARIES", "UTILITIES", "SUPPLIES", "MAINTENANCE", "MARKETING", "GOVERNMENT", "OTHER"])
    .optional(),
  description: z.string().min(1, "البيان مطلوب"),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  // When paying commissions: the exact rows this voucher settles (optional).
  commissionIds: z.array(z.string()).optional(),
  // Pay any amount against the therapist account and let the system settle
  // earned commissions oldest-first; a surplus simply stays as an advance.
  settleCommissions: z.boolean().optional(),
});

class DisbursementError extends Error {}

export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const cashAccountId = searchParams.get("cashAccountId");
  const paymentMethodId = searchParams.get("paymentMethodId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const { skip, take } = paginate(searchParams);

  const where = {
    ...(type ? { type: type as never } : {}),
    ...(cashAccountId ? { cashAccountId } : {}),
    ...(paymentMethodId ? { paymentMethodId } : {}),
    ...(from || to
      ? {
          paymentDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [rows, total, sum] = await Promise.all([
    prisma.disbursement.findMany({
      where,
      include: {
        cashAccount: { select: { name: true, type: true } },
        paymentMethod: { select: { id: true, name: true } },
        therapist: { select: { id: true, fullName: true } },
        patient: { select: { id: true, fullName: true } },
        issuedByUser: { select: { name: true } },
        _count: { select: { commissions: true } },
      },
      orderBy: { paymentDate: "desc" },
      skip,
      take,
    }),
    prisma.disbursement.count({ where }),
    prisma.disbursement.aggregate({ where, _sum: { amount: true } }),
  ]);

  return NextResponse.json({
    data: rows,
    total,
    totalAmount: Number(sum._sum.amount ?? 0),
    skip,
    take,
  });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;
  const payDate = d.paymentDate ? new Date(d.paymentDate) : new Date();

  try {
    const voucher = await prisma.$transaction(async (tx) => {
      // The current account this voucher debits
      let accountId = d.accountId;
      if (!accountId) {
        if (d.therapistId) accountId = await getTherapistAccountId(tx, d.therapistId);
        else if (d.patientId) accountId = await getPatientAccountId(tx, d.patientId);
        else accountId = await getExpenseAccountId(tx, d.expenseCategory ?? "OTHER");
      }

      // A commission voucher matches exactly only when specific rows were chosen
      if (d.type === "COMMISSION" && d.commissionIds?.length) {
        const commissions = await tx.therapistCommission.findMany({
          where: { id: { in: d.commissionIds } },
          select: { id: true, amount: true, isPaid: true },
        });
        if (commissions.length !== d.commissionIds.length) throw new DisbursementError("بعض العمولات غير موجودة");
        if (commissions.some((c) => c.isPaid)) throw new DisbursementError("بعض العمولات مدفوعة بالفعل");
        const owed = commissions.reduce((t, c) => t + Number(c.amount), 0);
        if (Math.abs(owed - d.amount) > 0.005) {
          throw new DisbursementError(
            `المبلغ (${d.amount.toFixed(2)}) لا يطابق إجمالي العمولات المحددة (${owed.toFixed(2)})`
          );
        }
      }

      const disbursement = await createDisbursement(tx, {
        accountId,
        type: d.type,
        amount: d.amount,
        paymentMethodId: d.paymentMethodId,
        paymentDate: payDate,
        description: d.description,
        referenceNumber: d.referenceNumber,
        notes: d.notes,
        expenseCategory: d.expenseCategory ?? null,
        issuedBy: auth.id,
      });

      // Mark commission rows as settled — informational; the account balance is what counts
      if (d.type === "COMMISSION") {
        if (d.commissionIds?.length) {
          await tx.therapistCommission.updateMany({
            where: { id: { in: d.commissionIds } },
            data: { isPaid: true, paidAt: payDate, paidBy: auth.id, disbursementId: disbursement.id },
          });
        } else if (d.settleCommissions && disbursement.therapistId) {
          // Free-amount payout: clear earned commissions oldest-first, as far as it goes
          let left = Number(disbursement.amount);
          const due = await tx.therapistCommission.findMany({
            where: { therapistId: disbursement.therapistId, isEarned: true, isPaid: false },
            orderBy: { createdAt: "asc" },
            select: { id: true, amount: true },
          });
          for (const c of due) {
            const owed = Number(c.amount);
            if (owed > left + 0.005) break;
            await tx.therapistCommission.update({
              where: { id: c.id },
              data: { isPaid: true, paidAt: payDate, paidBy: auth.id, disbursementId: disbursement.id },
            });
            left = round2(left - owed);
          }
        }
      }

      return disbursement;
    });

    return ok(voucher, 201);
  } catch (e) {
    if (e instanceof DisbursementError || e instanceof LedgerError) return badRequest({ message: e.message });
    throw e;
  }
}
