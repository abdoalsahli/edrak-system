import { NextResponse } from "next/server";
import { requireAuth, ok, notFound, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { recalcProgramInvoice, recalcSessionInvoice } from "@/lib/billing/InvoiceService";
import { syncInvoiceLedger } from "@/lib/ledger/LedgerService";
import { z } from "zod";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      patient: { select: { fullName: true } },
      billingCycle: { include: { program: { include: { service: { select: { name: true } }, therapist: { select: { fullName: true } } } } } },
      lines: { include: { session: { select: { programSequenceNumber: true, status: true } } } },
      payments: { include: { paymentMethod: { select: { name: true } } } },
      // Needed to know whether a standalone session was delivered (no refund once completed)
      standaloneSession: { select: { id: true, status: true } },
    },
  });

  if (!inv) return notFound();
  return ok(inv);
}

const UpdateSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "VOID"]).optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();

  const inv = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!inv) return notFound();

  // Re-derive the total from the program / session it belongs to.
  if (body.action === "recalc") {
    if (!inv.programId && !inv.sessionId) {
      return badRequest({ message: "هذه فاتورة يدوية — لا يمكن إعادة حسابها تلقائياً" });
    }
    const result = await prisma.$transaction((tx) =>
      inv.programId
        ? recalcProgramInvoice(tx, inv.programId!)
        : recalcSessionInvoice(tx, inv.sessionId!)
    );
    if (!result) return badRequest({ message: "تعذّر إعادة الحساب (الفاتورة ملغاة؟)" });
    return ok(result);
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  if (parsed.data.status === "VOID" && auth.role !== "MANAGER") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (parsed.data.status === "VOID" && Number(inv.paidAmount) > 0) {
    return badRequest({
      message: "لا يمكن إلغاء فاتورة عليها دفعات — سجّل استرداداً أولاً",
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.invoice.update({ where: { id: params.id }, data: parsed.data });
    // Voiding reverses the invoice on the patient account; re-issuing posts it again
    await syncInvoiceLedger(tx, params.id);
    return u;
  });

  return ok(updated);
}
