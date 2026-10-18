/**
 * One-off: move existing financial history into the current-accounts ledger.
 * Idempotent — safe to re-run; anything already posted is skipped.
 *
 *   npx tsx prisma/backfill-ledger.ts
 */
import { prisma } from "../src/lib/prisma";
import {
  getPatientAccountId,
  getTherapistAccountId,
  getExpenseAccountId,
  syncInvoiceLedger,
  syncCommissionLedger,
  postEntry,
  getBalances,
  naturalBalance,
  r2,
} from "../src/lib/ledger/LedgerService";

async function main() {
  // 1. An account for every patient and therapist
  const [patients, therapists] = await Promise.all([
    prisma.patient.findMany({ select: { id: true } }),
    prisma.therapist.findMany({ select: { id: true } }),
  ]);
  for (const p of patients) await prisma.$transaction((tx) => getPatientAccountId(tx, p.id));
  for (const t of therapists) await prisma.$transaction((tx) => getTherapistAccountId(tx, t.id));
  console.log(`accounts: ${patients.length} patient(s), ${therapists.length} therapist(s)`);

  // 2. Invoices → debit patient accounts (at their current value)
  const invoices = await prisma.invoice.findMany({ select: { id: true } });
  for (const inv of invoices) await prisma.$transaction((tx) => syncInvoiceLedger(tx, inv.id));
  console.log(`invoices synced: ${invoices.length}`);

  // 3. Receipts → credit patient accounts
  const payments = await prisma.payment.findMany({
    select: { id: true, accountId: true, patientId: true, amount: true, paymentDate: true, voucherNumber: true, notes: true },
  });
  let receipts = 0;
  for (const pay of payments) {
    await prisma.$transaction(async (tx) => {
      let accountId = pay.accountId;
      if (!accountId) {
        if (!pay.patientId) return;
        accountId = await getPatientAccountId(tx, pay.patientId);
        await tx.payment.update({ where: { id: pay.id }, data: { accountId } });
      }
      const exists = await tx.ledgerEntry.count({ where: { sourceType: "RECEIPT", sourceId: pay.id } });
      if (exists) return;
      const amount = Number(pay.amount);
      await postEntry(tx, {
        accountId,
        date: pay.paymentDate,
        credit: amount > 0 ? amount : 0,
        debit: amount < 0 ? -amount : 0, // a legacy refund stored as a negative receipt
        description: amount < 0 ? "استرداد" : pay.notes ? `سند قبض — ${pay.notes}` : "سند قبض",
        sourceType: "RECEIPT",
        sourceId: pay.id,
        reference: pay.voucherNumber,
      });
      receipts++;
    });
  }
  console.log(`receipts posted: ${receipts} of ${payments.length}`);

  // 4. Commissions → credit therapist accounts
  const commissions = await prisma.therapistCommission.findMany({ select: { sessionId: true } });
  for (const c of commissions) await prisma.$transaction((tx) => syncCommissionLedger(tx, c.sessionId));
  console.log(`commissions synced: ${commissions.length}`);

  // 5. Payment vouchers → debit the account they paid
  const disbursements = await prisma.disbursement.findMany({
    select: {
      id: true, accountId: true, therapistId: true, patientId: true, expenseCategory: true,
      amount: true, paymentDate: true, voucherNumber: true, description: true,
    },
  });
  let paid = 0;
  for (const d of disbursements) {
    await prisma.$transaction(async (tx) => {
      let accountId = d.accountId;
      if (!accountId) {
        accountId = d.therapistId
          ? await getTherapistAccountId(tx, d.therapistId)
          : d.patientId
          ? await getPatientAccountId(tx, d.patientId)
          : await getExpenseAccountId(tx, d.expenseCategory ?? "OTHER");
        await tx.disbursement.update({ where: { id: d.id }, data: { accountId } });
      }
      const exists = await tx.ledgerEntry.count({ where: { sourceType: "PAYMENT", sourceId: d.id } });
      if (exists) return;
      await postEntry(tx, {
        accountId,
        date: d.paymentDate,
        debit: Number(d.amount),
        description: d.description,
        sourceType: "PAYMENT",
        sourceId: d.id,
        reference: d.voucherNumber,
      });
      paid++;
    });
  }
  console.log(`payment vouchers posted: ${paid} of ${disbursements.length}`);

  // ─── Reconcile against the old way of computing balances ─────────────────
  console.log("\n=== reconciliation ===");
  const accounts = await prisma.ledgerAccount.findMany();
  const sums = await getBalances(prisma);
  let mismatches = 0;

  for (const a of accounts) {
    const t = sums.get(a.id) ?? { debit: 0, credit: 0 };
    const ledger = naturalBalance(a.nature, t.debit, t.credit);

    let expected: number | null = null;
    if (a.patientId) {
      const [inv, pay, refund] = await Promise.all([
        prisma.invoice.aggregate({ where: { patientId: a.patientId, status: { not: "VOID" } }, _sum: { totalAmount: true } }),
        prisma.payment.aggregate({ where: { patientId: a.patientId }, _sum: { amount: true } }),
        prisma.disbursement.aggregate({ where: { patientId: a.patientId }, _sum: { amount: true } }),
      ]);
      // owed = invoices − receipts (receipts net of legacy refunds) + refunds paid by voucher
      expected = r2(Number(inv._sum.totalAmount ?? 0) - Number(pay._sum.amount ?? 0) + Number(refund._sum.amount ?? 0));
    } else if (a.therapistId) {
      const [com, out] = await Promise.all([
        prisma.therapistCommission.aggregate({ where: { therapistId: a.therapistId }, _sum: { amount: true } }),
        prisma.disbursement.aggregate({ where: { therapistId: a.therapistId }, _sum: { amount: true } }),
      ]);
      expected = r2(Number(com._sum.amount ?? 0) - Number(out._sum.amount ?? 0));
    }

    if (t.debit === 0 && t.credit === 0 && (expected ?? 0) === 0) continue;
    const ok = expected === null || Math.abs(expected - ledger) < 0.01;
    if (!ok) mismatches++;
    console.log(
      `${ok ? "OK      " : "MISMATCH"} ${a.code} ${a.name.padEnd(22)} ledger=${ledger.toFixed(2)}` +
        (expected !== null ? ` expected=${expected.toFixed(2)}` : "")
    );
  }
  const entries = await prisma.ledgerEntry.count();
  console.log(`\nentries: ${entries} · accounts: ${accounts.length} · mismatches: ${mismatches}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
