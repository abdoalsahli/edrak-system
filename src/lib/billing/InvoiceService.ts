import type { Prisma, InvoiceStatus, SessionStatus } from "@prisma/client";
import { syncInvoiceLedger } from "@/lib/ledger/LedgerService";

/**
 * Single source of truth for invoice totals.
 *
 * Rules
 * ─────
 * Program invoice:
 *   • While the program is ACTIVE / EXTENDED → preliminary total = pending + completed + charged sessions
 *   • Once the program is CANCELLED / COMPLETED → final total = completed + charged sessions
 *
 * Standalone session invoice:
 *   • PENDING / COMPLETED → the session's own price
 *   • ABSENT / CANCELLED_BY_* → the price only if the user chose to charge it, otherwise 0
 *
 * An absence or cancellation is never charged automatically — the user decides
 * when recording the outcome (Session.isCharged).
 *
 * Never lowers a total below what the patient has already paid without flagging it —
 * the caller can detect an over-payment (credit) via the returned `credit` value.
 */

/**
 * Is this session part of the bill?
 * Delivered or still-upcoming sessions always are; an absence or cancellation
 * only when the user explicitly chose to charge it.
 */
export function isBillable(status: SessionStatus, isCharged: boolean): boolean {
  return status === "PENDING" || status === "COMPLETED" || isCharged;
}

/** Tolerance for decimal comparison (2dp currency). */
const EPS = 0.005;

export type RecalcResult = {
  invoiceId: string;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  /** > 0 when the patient has paid more than the (adjusted) total — a refund is owed. */
  credit: number;
};

/**
 * Derive the correct invoice status from its amounts.
 * `closed` = the underlying program/session is finished, so a 0 total means "nothing owed".
 */
export function deriveInvoiceStatus(
  totalAmount: number,
  paidAmount: number,
  closed = false
): InvoiceStatus {
  if (totalAmount <= EPS) {
    // Nothing billable: money already received is a credit to refund, not a draft
    if (paidAmount > EPS) return "PAID";
    return closed ? "VOID" : "DRAFT";
  }
  if (paidAmount <= EPS) return "ISSUED";
  if (paidAmount >= totalAmount - EPS) return "PAID";
  return "PARTIAL";
}

/**
 * Recalculate the invoice attached to a program.
 * Call after: creating, extending, cancelling or completing a program,
 * and after any of its sessions changes outcome.
 */
export async function recalcProgramInvoice(
  tx: Prisma.TransactionClient,
  programId: string,
  reason?: string // what happened, for the ledger line (see syncInvoiceLedger)
): Promise<RecalcResult | null> {
  const program = await tx.program.findUnique({
    where: { id: programId },
    select: { status: true, sessionPrice: true },
  });
  if (!program) return null;

  const invoice = await tx.invoice.findUnique({
    where: { programId },
    select: { id: true, paidAmount: true, status: true },
  });
  // A manually voided invoice is never revived automatically.
  if (!invoice || invoice.status === "VOID") return null;

  const closed = program.status === "CANCELLED" || program.status === "COMPLETED";

  // Sum the price agreed for each billable session.
  // Running program -> pending + completed + charged; closed -> completed + charged.
  const agg = await tx.session.aggregate({
    where: {
      programId,
      OR: closed
        ? [{ status: "COMPLETED" }, { isCharged: true }]
        : [{ status: { in: ["PENDING", "COMPLETED"] } }, { isCharged: true }],
    },
    _sum: { price: true },
  });

  const totalAmount = round2(Number(agg._sum.price ?? 0));
  const paidAmount = Number(invoice.paidAmount);
  const status = deriveInvoiceStatus(totalAmount, paidAmount, closed);

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { totalAmount, status },
  });

  // Post the change to the patient's current account
  await syncInvoiceLedger(tx, invoice.id, reason);

  return {
    invoiceId: invoice.id,
    totalAmount,
    paidAmount,
    status,
    credit: Math.max(0, round2(paidAmount - totalAmount)),
  };
}

/**
 * Recalculate the invoice attached to a standalone (non-program) session.
 * Call after the session's outcome is recorded.
 */
export async function recalcSessionInvoice(
  tx: Prisma.TransactionClient,
  sessionId: string
): Promise<RecalcResult | null> {
  const session = await tx.session.findUnique({
    where: { id: sessionId },
    select: { status: true, price: true, isCharged: true },
  });
  if (!session) return null;

  const invoice = await tx.invoice.findUnique({
    where: { sessionId },
    select: { id: true, paidAmount: true, status: true },
  });
  if (!invoice || invoice.status === "VOID") return null;

  const billable = isBillable(session.status, session.isCharged);
  const totalAmount = billable ? round2(Number(session.price ?? 0)) : 0;
  const paidAmount = Number(invoice.paidAmount);
  const status = deriveInvoiceStatus(totalAmount, paidAmount, !billable);

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { totalAmount, status },
  });

  // Post the change to the patient's current account
  await syncInvoiceLedger(tx, invoice.id);

  return {
    invoiceId: invoice.id,
    totalAmount,
    paidAmount,
    status,
    credit: Math.max(0, round2(paidAmount - totalAmount)),
  };
}

/**
 * Recalculate whichever auto-invoice a session belongs to
 * (its program's invoice, or its own standalone invoice).
 */
export async function recalcInvoiceForSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
  programId: string | null,
  reason?: string
): Promise<RecalcResult | null> {
  return programId
    ? recalcProgramInvoice(tx, programId, reason)
    : recalcSessionInvoice(tx, sessionId);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
