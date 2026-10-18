import type { Prisma } from "@prisma/client";

/**
 * Sequential numbering for financial documents.
 *
 * Numbers are per document-type, per calendar year, and gap-free:
 *   قبض  →  RCV-2026-00001
 *   صرف  →  PAY-2026-00001
 *
 * The counter row is updated inside the caller's transaction, so two
 * concurrent vouchers can never receive the same number — the second
 * waits on the row lock taken by the first.
 */

export type DocType = "RECEIPT" | "DISBURSEMENT" | "SETTLEMENT";

const PREFIX: Record<DocType, string> = {
  RECEIPT: "RCV",
  DISBURSEMENT: "PAY",
  SETTLEMENT: "STL",
};

/**
 * Reserve the next voucher number for `docType` in the year of `date`.
 * MUST be called inside a transaction — the counter update is what
 * serialises concurrent callers.
 */
export async function nextVoucherNumber(
  tx: Prisma.TransactionClient,
  docType: DocType,
  date: Date = new Date()
): Promise<string> {
  const year = date.getFullYear();

  // upsert + increment in one statement: the row lock serialises concurrent callers
  const counter = await tx.documentCounter.upsert({
    where: { docType_year: { docType, year } },
    update: { lastNumber: { increment: 1 } },
    create: { docType, year, lastNumber: 1 },
  });

  return `${PREFIX[docType]}-${year}-${String(counter.lastNumber).padStart(5, "0")}`;
}

/** Human-readable Arabic label for a voucher number. */
export function voucherLabel(voucherNumber: string): string {
  if (voucherNumber.startsWith("RCV-")) return `سند قبض ${voucherNumber}`;
  if (voucherNumber.startsWith("PAY-")) return `سند صرف ${voucherNumber}`;
  if (voucherNumber.startsWith("STL-")) return `تسوية ${voucherNumber}`;
  return voucherNumber;
}
