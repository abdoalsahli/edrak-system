import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { addDays } from "date-fns";
import { syncInvoiceLedger } from "@/lib/ledger/LedgerService";

const CreateSchema = z.object({
  patientId: z.string(),
  billingCycleId: z.string().optional(),
  lines: z.array(z.object({
    sessionId: z.string().optional(),
    description: z.string().min(1, "وصف البند مطلوب"),
    qty: z.number().int().min(1).default(1),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).default(0),
  })).min(1, "يجب إضافة بند واحد على الأقل"),
  dueInDays: z.number().default(30),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");
  const { skip, take } = paginate(searchParams);

  const where = {
    ...(patientId ? { patientId } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        patient: { select: { fullName: true } },
        billingCycle: { select: { cycleNumber: true, program: { select: { service: { select: { name: true } } } } } },
        program: { select: { id: true, service: { select: { name: true } } } },
        standaloneSession: { select: { id: true, service: { select: { name: true } } } },
        lines: true,
        payments: { select: { id: true, amount: true, paymentDate: true, paymentMethod: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({ data: invoices, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["MANAGER", "ACCOUNTANT"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);
  const d = parsed.data;

  const totalAmount = d.lines.reduce((sum, l) => sum + l.qty * l.unitPrice - l.discount, 0);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.create({
      data: {
        patientId: d.patientId,
        billingCycleId: d.billingCycleId ?? null,
        issuedBy: auth.id,
        issueDate: new Date(),
        dueDate: addDays(new Date(), d.dueInDays),
        totalAmount,
        paidAmount: 0,
        status: "DRAFT",
        notes: d.notes ?? null,
      },
    });

    await tx.invoiceLine.createMany({
      data: d.lines.map((l) => ({
        invoiceId: inv.id,
        sessionId: l.sessionId ?? null,
        description: l.description,
        qty: l.qty,
        unitPrice: l.unitPrice,
        discount: l.discount,
        total: l.qty * l.unitPrice - l.discount,
      })),
    });

    if (d.billingCycleId) {
      await tx.billingCycle.update({ where: { id: d.billingCycleId }, data: { status: "INVOICED" } });
    }

    // Debit the patient's current account
    await syncInvoiceLedger(tx, inv.id);

    return inv;
  });

  return ok(invoice);
}
