import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { validateAvailability } from "@/lib/scheduling/SchedulingService";
import { deriveInvoiceStatus } from "@/lib/billing/InvoiceService";
import { nextVoucherNumber } from "@/lib/billing/VoucherService";
import { createReceipt, getPatientAccountId, syncInvoiceLedger, syncCommissionLedger, LedgerError } from "@/lib/ledger/LedgerService";
import { z } from "zod";
import { addDays } from "date-fns";

/** Thrown inside the transaction to roll it back with a user-facing message. */
class SessionError extends Error {}

const CreateSchema = z.object({
  patientId: z.string(),
  serviceId: z.string(),
  therapistId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  roomId: z.string().optional(),
  // Value of this session, entered by the user. Falls back to the service default.
  price: z.number().min(0).optional(),
  notes: z.string().optional(),
  isInsuranceCovered: z.boolean().default(false),
  insuranceProviderId: z.string().optional(),
  // Receipt captured at booking time — full or partial
  payment: z
    .object({
      amount: z.number().positive(),
      paymentMethodId: z.string({ required_error: "اختر طريقة الدفع" }),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");
  const { skip, take } = paginate(searchParams);

  const sessions = await prisma.session.findMany({
    where: {
      programId: null,
      ...(patientId ? { patientId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      patient: { select: { fullName: true } },
      service: { select: { name: true } },
      appointments: {
        where: { deletedAt: null },
        include: { therapist: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  const total = await prisma.session.count({
    where: {
      programId: null,
      ...(patientId ? { patientId } : {}),
      ...(status ? { status: status as never } : {}),
    },
  });

  return NextResponse.json({ data: sessions, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  const d = parsed.data;

  // Validate availability
  const check = await validateAvailability(d.therapistId, d.patientId, d.date, d.startTime, d.endTime);
  if (!check.ok) return badRequest({ message: check.reason });

  try {
  const session = await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({ where: { id: d.serviceId }, select: { name: true, defaultPrice: true } });

    // The user-entered price wins; the service default is only a fallback.
    const unitPrice = Number(d.price ?? service?.defaultPrice ?? 0);

    const s = await tx.session.create({
      data: {
        patientId: d.patientId,
        serviceId: d.serviceId,
        status: "PENDING",
        price: unitPrice,
        outcomeNotes: d.notes ?? null,
        createdBy: auth.id,
      },
    });
    await tx.appointment.create({
      data: {
        sessionId: s.id,
        therapistId: d.therapistId,
        roomId: d.roomId ?? null,
        date: new Date(d.date),
        startTime: d.startTime,
        endTime: d.endTime,
        status: "SCHEDULED",
        isInsuranceCovered: d.isInsuranceCovered,
        insuranceProviderId: d.insuranceProviderId ?? null,
        scheduledBy: auth.id,
      },
    });

    // Auto-create invoice for this standalone session at the agreed price
    const invoice = await tx.invoice.create({
      data: {
        sessionId:   s.id,
        patientId:   d.patientId,
        issuedBy:    auth.id,
        issueDate:   new Date(d.date),
        dueDate:     addDays(new Date(d.date), 30),
        totalAmount: unitPrice,
        paidAmount:  0,
        status:      unitPrice > 0 ? "ISSUED" : "DRAFT",
        notes:       `فاتورة جلسة — ${service?.name ?? ""}`,
      },
    });

    // Session value → debit on the patient account
    await syncInvoiceLedger(tx, invoice.id);

    // Payment taken at booking → a receipt on the patient's current account
    if (d.payment) {
      await createReceipt(tx, {
        accountId: await getPatientAccountId(tx, d.patientId),
        amount: d.payment.amount,
        paymentMethodId: d.payment.paymentMethodId,
        referenceNumber: d.payment.referenceNumber,
        notes: d.payment.notes,
        description: `دفعة جلسة — ${service?.name ?? ""}`,
        receivedBy: auth.id,
      });
    }

    return s;
  });

  return ok(session);
  } catch (e) {
    if (e instanceof SessionError) return badRequest({ message: e.message });
    if (e instanceof LedgerError) return badRequest({ message: e.message });
    throw e;
  }
}
