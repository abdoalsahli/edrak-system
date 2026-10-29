import { NextResponse } from "next/server";
import { requireAuth, ok, badRequest, paginate } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus, round2 } from "@/lib/billing/InvoiceService";
import { nextVoucherNumber } from "@/lib/billing/VoucherService";
import { createReceipt, getPatientAccountId, syncInvoiceLedger, syncProgramCommissionLedger, LedgerError } from "@/lib/ledger/LedgerService";
import { z } from "zod";
import { addDays, format } from "date-fns";

/** Thrown inside the transaction to roll it back with a user-facing message. */
class ProgramError extends Error {}

/**
 * Split a total into n parts that add up to exactly the total.
 * Any leftover piastres go to the first sessions, so 1000 over 3 sessions
 * becomes 333.34 + 333.33 + 333.33 rather than losing a piastre.
 */
function splitAmount(total: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  let remainder = cents - base * n;
  return Array.from({ length: n }, () => {
    const c = base + (remainder-- > 0 ? 1 : 0);
    return c / 100;
  });
}

const CreateSchema = z.object({
  patientId: z.string(),
  serviceId: z.string(),
  therapistId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionsPerWeek: z.number().int().min(1).max(7),
  totalSessions: z.number().int().min(1),
  durationMin: z.number().int().min(15).default(60),
  // Agreed TOTALS for this program; split evenly across the sessions actually created.
  totalValue: z.number().min(0).optional(),
  totalCommission: z.number().min(0).optional(),
  // Legacy per-session price. Used only when no totals are given.
  sessionPrice: z.number().min(0).optional(),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().optional(),
  // Down payment / receipt captured at registration — full or partial
  payment: z
    .object({
      amount: z.number().positive(),
      paymentMethodId: z.string({ required_error: "اختر طريقة الدفع" }),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  // proposed appointments from the scheduling wizard preview
  appointments: z.array(z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    sequenceNumber: z.number(),
  })),
});

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get("patientId");
  const status = searchParams.get("status");
  const q = searchParams.get("q") ?? "";
  const { skip, take } = paginate(searchParams);

  const where = {
    ...(patientId ? { patientId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q ? { patient: { fullName: { contains: q } } } : {}),
  };

  const [programs, total] = await Promise.all([
    prisma.program.findMany({
      where,
      include: {
        patient: { select: { id: true, fullName: true } },
        therapist: { select: { fullName: true } },
        service: { select: { name: true } },
        _count: { select: { sessions: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.program.count({ where }),
  ]);

  // Compute consumed sessions per program
  const programIds = programs.map((p) => p.id);
  const consumed = await prisma.session.groupBy({
    by: ["programId"],
    where: { programId: { in: programIds }, status: { in: ["COMPLETED", "ABSENT"] } },
    _count: { _all: true },
  });
  const consumedMap = Object.fromEntries(consumed.map((c) => [c.programId!, c._count._all]));

  const data = programs.map((p) => ({
    ...p,
    consumedSessions: consumedMap[p.id] ?? 0,
    remainingSessions: p.plannedSessions - (consumedMap[p.id] ?? 0),
  }));

  return NextResponse.json({ data, total, skip, take });
}

export async function POST(req: Request) {
  const auth = await requireAuth(["RECEPTIONIST", "MANAGER"]);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.flatten().fieldErrors);

  const d = parsed.data;
  const userId = auth.id;

  // Compute expected end date from the last appointment
  const sortedApts = [...d.appointments].sort((a, b) => a.date.localeCompare(b.date));
  const lastDate = sortedApts[sortedApts.length - 1]?.date ?? d.startDate;
  const expectedEndDate = addDays(new Date(lastDate), 1);

  try {
  const program = await prisma.$transaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: d.serviceId },
      select: { name: true, defaultPrice: true },
    });
    const count = d.appointments.length;

    // The programme is agreed as totals; per-session values are derived from them.
    const fallbackUnit = Number(d.sessionPrice ?? service?.defaultPrice ?? 0);
    const totalValue = round2(d.totalValue != null ? d.totalValue : fallbackUnit * count);
    const totalCommission = round2(d.totalCommission ?? 0);

    if (totalCommission > totalValue + 0.005) {
      throw new ProgramError("عمولة الأخصائي تتجاوز قيمة البرنامج");
    }

    const prices = splitAmount(totalValue, count);
    const commissions = splitAmount(totalCommission, count);
    const unitPrice = count > 0 ? round2(totalValue / count) : 0;
    const unitCommission = count > 0 ? round2(totalCommission / count) : 0;

    const prog = await tx.program.create({
      data: {
        patientId: d.patientId,
        serviceId: d.serviceId,
        therapistId: d.therapistId,
        startDate: new Date(d.startDate),
        expectedEndDate,
        sessionsPerWeek: d.sessionsPerWeek,
        originalPlannedSessions: d.totalSessions,
        plannedSessions: d.totalSessions,
        sessionPrice: unitPrice,
        sessionCommission: unitCommission,
        status: "ACTIVE",
        notes: d.notes ?? null,
        createdBy: userId,
      },
    });

    // Create sessions + appointments in bulk
    const createdSessionIds: string[] = [];
    for (const [i, apt] of d.appointments.entries()) {
      const session = await tx.session.create({
        data: {
          patientId: d.patientId,
          serviceId: d.serviceId,
          programId: prog.id,
          programSequenceNumber: apt.sequenceNumber,
          status: "PENDING",
          price: prices[i],
          commissionAmount: commissions[i],
          createdBy: userId,
        },
      });
      createdSessionIds.push(session.id);

      // The commission is recorded on the therapist account as soon as the programme
      // is created, but stays UNEARNED until the session is actually delivered.
      if (commissions[i] > 0) {
        await tx.therapistCommission.create({
          data: {
            therapistId:    d.therapistId,
            sessionId:      session.id,
            commissionType: "FIXED",
            rate:           null,
            baseAmount:     null,
            amount:         commissions[i],
            isEarned:       false,
          },
        });
      }
      await tx.appointment.create({
        data: {
          sessionId: session.id,
          therapistId: d.therapistId,
          date: new Date(apt.date),
          startTime: apt.startTime,
          endTime: apt.endTime,
          status: "SCHEDULED",
          scheduledBy: userId,
        },
      });
    }

    // Auto-create invoice for this program with the full preliminary value.
    // Uses the appointments actually scheduled, which may be fewer than requested.
    const createdSessions = count;
    const totalAmount = totalValue;
    const invoice = await tx.invoice.create({
      data: {
        programId:   prog.id,
        patientId:   d.patientId,
        issuedBy:    userId,
        issueDate:   new Date(d.startDate),
        dueDate:     addDays(new Date(d.startDate), 30),
        totalAmount,          // full program value upfront
        paidAmount:  0,
        status:      totalAmount > 0 ? "ISSUED" : "DRAFT",
        notes:       `فاتورة برنامج ${service?.name ?? ""} — ${createdSessions} جلسة × ${unitPrice} د.ل`,
      },
    });

    // Programme value → debit on the patient account; commissions → credit on the therapist account
    await syncInvoiceLedger(tx, invoice.id);
    await syncProgramCommissionLedger(tx, prog.id);

    // Down payment → a receipt on the patient's current account (not tied to the invoice)
    if (d.payment) {
      await createReceipt(tx, {
        accountId: await getPatientAccountId(tx, d.patientId),
        amount: d.payment.amount,
        paymentMethodId: d.payment.paymentMethodId,
        referenceNumber: d.payment.referenceNumber,
        notes: d.payment.notes,
        description: `دفعة مقدّمة — برنامج ${service?.name ?? ""}`,
        receivedBy: userId,
      });
    }

    return prog;
  });

  return ok(program);
  } catch (e) {
    if (e instanceof ProgramError) return badRequest({ message: e.message });
    if (e instanceof LedgerError) return badRequest({ message: e.message });
    throw e;
  }
}
