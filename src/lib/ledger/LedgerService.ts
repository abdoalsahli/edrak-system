import type {
  Prisma,
  AccountKind,
  AccountNature,
  LedgerSource,
  ExpenseCategory,
  DisbursementType,
} from "@prisma/client";
import { nextVoucherNumber } from "@/lib/billing/VoucherService";

/**
 * Current accounts (حسابات جارية).
 *
 * Every party has exactly one ledger account and every financial document posts
 * entries to it. Balances and statements are read from ledger_entries ONLY, so
 * every screen agrees.
 *
 * Rule: posted entries are never rewritten. When the value behind a document
 * changes (an invoice reduced when a programme ends early, a commission reversed
 * for an undelivered session) only the DIFFERENCE is posted, dated the day it
 * happened — the statement stays a truthful history.
 *
 * This module must not import InvoiceService (InvoiceService imports it).
 */

type Tx = Prisma.TransactionClient;

export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const EPS = 0.005;

/** Thrown inside a transaction to roll it back with a user-facing message. */
export class LedgerError extends Error {}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const ACCOUNT_KIND_AR: Record<AccountKind, string> = {
  PATIENT: "مريض",
  THERAPIST: "أخصائي",
  EXPENSE: "مصروف",
  CUSTOM: "حساب عام",
  CASH: "صندوق / بنك",
};

export const ACCOUNT_NATURE_AR: Record<AccountNature, string> = {
  DEBIT: "مدين",
  CREDIT: "دائن",
};

export const EXPENSE_CATEGORY_AR: Record<ExpenseCategory, string> = {
  RENT: "إيجار",
  SALARIES: "رواتب",
  UTILITIES: "خدمات (كهرباء/ماء/إنترنت)",
  SUPPLIES: "مستلزمات",
  MAINTENANCE: "صيانة",
  MARKETING: "تسويق",
  GOVERNMENT: "رسوم حكومية",
  OTHER: "مصروفات أخرى",
};

const KIND_PREFIX: Record<AccountKind, string> = {
  PATIENT: "P",
  THERAPIST: "T",
  EXPENSE: "E",
  CUSTOM: "C",
  CASH: "B",
};

/**
 * Balance in the account's natural direction.
 * DEBIT accounts (patients, expenses): debit − credit → what the party owes.
 * CREDIT accounts (therapists, payables): credit − debit → what we owe them.
 */
export function naturalBalance(nature: AccountNature, debit: number, credit: number): number {
  return r2(nature === "DEBIT" ? debit - credit : credit - debit);
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export async function nextAccountCode(tx: Tx, kind: AccountKind): Promise<string> {
  const ctr = await tx.documentCounter.upsert({
    where: { docType_year: { docType: `ACCOUNT_${kind}`, year: 0 } },
    update: { lastNumber: { increment: 1 } },
    create: { docType: `ACCOUNT_${kind}`, year: 0, lastNumber: 1 },
  });
  return `${KIND_PREFIX[kind]}-${String(ctr.lastNumber).padStart(4, "0")}`;
}

/** The patient's current account, created on first use. Nature: DEBIT. */
export async function getPatientAccountId(tx: Tx, patientId: string): Promise<string> {
  const existing = await tx.ledgerAccount.findUnique({ where: { patientId }, select: { id: true } });
  if (existing) return existing.id;
  const patient = await tx.patient.findUnique({ where: { id: patientId }, select: { fullName: true } });
  const acc = await tx.ledgerAccount.create({
    data: {
      code: await nextAccountCode(tx, "PATIENT"),
      name: patient?.fullName ?? "مريض",
      kind: "PATIENT",
      nature: "DEBIT",
      patientId,
    },
    select: { id: true },
  });
  return acc.id;
}

/** The therapist's current account, created on first use. Nature: CREDIT. */
export async function getTherapistAccountId(tx: Tx, therapistId: string): Promise<string> {
  const existing = await tx.ledgerAccount.findUnique({ where: { therapistId }, select: { id: true } });
  if (existing) return existing.id;
  const therapist = await tx.therapist.findUnique({ where: { id: therapistId }, select: { fullName: true } });
  const acc = await tx.ledgerAccount.create({
    data: {
      code: await nextAccountCode(tx, "THERAPIST"),
      name: therapist?.fullName ?? "أخصائي",
      kind: "THERAPIST",
      nature: "CREDIT",
      therapistId,
    },
    select: { id: true },
  });
  return acc.id;
}

/** The system expense account for a category, created on first use. Nature: DEBIT. */
export async function getExpenseAccountId(tx: Tx, category: ExpenseCategory): Promise<string> {
  const existing = await tx.ledgerAccount.findUnique({ where: { expenseCategory: category }, select: { id: true } });
  if (existing) return existing.id;
  const acc = await tx.ledgerAccount.create({
    data: {
      code: await nextAccountCode(tx, "EXPENSE"),
      name: `مصروف ${EXPENSE_CATEGORY_AR[category]}`,
      kind: "EXPENSE",
      nature: "DEBIT",
      expenseCategory: category,
    },
    select: { id: true },
  });
  return acc.id;
}

/**
 * The ledger account of a cash box / bank, created on first use.
 * Nature DEBIT (an asset). Its opening balance is posted as an OPENING entry
 * dated the day the box was created, so the box balance comes from the ledger.
 */
export async function getCashLedgerAccountId(tx: Tx, cashAccountId: string): Promise<string> {
  const existing = await tx.ledgerAccount.findUnique({ where: { cashAccountId }, select: { id: true } });
  if (existing) return existing.id;
  const box = await tx.cashAccount.findUnique({
    where: { id: cashAccountId },
    select: { name: true, openingBalance: true, createdAt: true, isActive: true },
  });
  if (!box) throw new LedgerError("الصندوق غير موجود");
  const acc = await tx.ledgerAccount.create({
    data: {
      code: await nextAccountCode(tx, "CASH"),
      name: box.name,
      kind: "CASH",
      nature: "DEBIT",
      cashAccountId,
      isActive: box.isActive,
    },
    select: { id: true },
  });
  const opening = r2(Number(box.openingBalance));
  if (Math.abs(opening) > EPS) {
    await postEntry(tx, {
      accountId: acc.id,
      date: box.createdAt,
      debit: opening > 0 ? opening : 0,
      credit: opening < 0 ? -opening : 0,
      description: "رصيد افتتاحي",
      sourceType: "OPENING",
      sourceId: cashAccountId,
    });
  }
  return acc.id;
}

/** Create a cash box / bank together with its ledger account and opening entry. */
export async function createCashAccount(
  tx: Tx,
  d: { name: string; type: "CASH" | "BANK"; accountNumber?: string | null; openingBalance?: number; notes?: string | null }
) {
  const box = await tx.cashAccount.create({
    data: {
      name: d.name,
      type: d.type,
      accountNumber: d.accountNumber ?? null,
      openingBalance: r2(d.openingBalance ?? 0),
      notes: d.notes ?? null,
    },
  });
  const ledgerAccountId = await getCashLedgerAccountId(tx, box.id);
  return { ...box, ledgerAccountId };
}

async function requireActiveAccount(tx: Tx, accountId: string) {
  const acc = await tx.ledgerAccount.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, isActive: true, patientId: true, therapistId: true, kind: true },
  });
  if (!acc) throw new LedgerError("الحساب غير موجود");
  if (!acc.isActive) throw new LedgerError("الحساب معطّل");
  return acc;
}

// ─── Posting ─────────────────────────────────────────────────────────────────

type EntryInput = {
  accountId: string;
  date: Date;
  debit?: number;
  credit?: number;
  description: string;
  sourceType: LedgerSource;
  sourceId: string;
  reference?: string | null;
  createdBy?: string | null;
};

export async function postEntry(tx: Tx, e: EntryInput) {
  const debit = r2(e.debit ?? 0);
  const credit = r2(e.credit ?? 0);
  if (debit <= EPS && credit <= EPS) return null;
  return tx.ledgerEntry.create({
    data: {
      accountId: e.accountId,
      date: e.date,
      debit,
      credit,
      description: e.description.slice(0, 190),
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      reference: e.reference ?? null,
      createdBy: e.createdBy ?? null,
    },
  });
}

/**
 * Post only the difference between what a source SHOULD be on an account and
 * what has already been posted for it. `targetNet` is debit-positive
 * (an invoice of 500 → +500; a commission of 60 → −60; nothing → 0).
 */
async function syncSourceOnAccount(
  tx: Tx,
  o: {
    accountId: string;
    sourceType: LedgerSource;
    sourceId: string;
    targetNet: number;
    firstDate: Date;
    firstDescription: string;
    adjustDescription: string;
    reference?: string | null;
  }
) {
  const agg = await tx.ledgerEntry.aggregate({
    where: { accountId: o.accountId, sourceType: o.sourceType, sourceId: o.sourceId },
    _sum: { debit: true, credit: true },
    _count: { _all: true },
  });
  const posted = r2(Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0));
  const diff = r2(o.targetNet - posted);
  if (Math.abs(diff) < EPS) return;

  const isFirst = agg._count._all === 0;
  // An entry is never dated in the future (a program invoice carries the program's start
  // date), otherwise the statement would show later adjustments before the original entry.
  const now = new Date();
  await postEntry(tx, {
    accountId: o.accountId,
    date: isFirst && o.firstDate <= now ? o.firstDate : now,
    debit: diff > 0 ? diff : 0,
    credit: diff < 0 ? -diff : 0,
    description: isFirst ? o.firstDescription : o.adjustDescription,
    sourceType: o.sourceType,
    sourceId: o.sourceId,
    reference: o.reference,
  });
}

/** Remove every entry of a source — only for documents booked by mistake and deleted. */
export async function deleteSourceEntries(tx: Tx, sourceType: LedgerSource, sourceId: string) {
  await tx.ledgerEntry.deleteMany({ where: { sourceType, sourceId } });
}

// ─── Invoices → patient account (debit) ──────────────────────────────────────

/**
 * Keep the patient account in line with an invoice's current value.
 * Call after any change to an invoice's total or status.
 */
export async function syncInvoiceLedger(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      patientId: true, totalAmount: true, status: true, issueDate: true, notes: true,
      program: { select: { id: true, status: true, service: { select: { name: true } } } },
    },
  });
  if (!inv) return;
  const accountId = await getPatientAccountId(tx, inv.patientId);
  // An empty note is common on manual invoices — never post a blank description
  const label = inv.notes?.trim() || "فاتورة";
  const total = r2(Number(inv.totalAmount));

  // A programme adjustment says what the bill became, not what it was
  let adjust = `تعديل قيمة: ${label}`;
  if (inv.program) {
    const closed = inv.program.status === "COMPLETED" || inv.program.status === "CANCELLED";
    const n = await tx.session.count({
      where: {
        programId: inv.program.id,
        OR: closed ? [{ status: "COMPLETED" }, { isCharged: true }] : [{ status: { in: ["PENDING", "COMPLETED"] } }, { isCharged: true }],
      },
    });
    adjust = `تعديل فاتورة برنامج ${inv.program.service.name} — أصبحت ${n} جلسة بإجمالي ${total}`;
  }

  await syncSourceOnAccount(tx, {
    accountId,
    sourceType: "INVOICE",
    sourceId: invoiceId,
    targetNet: inv.status === "VOID" ? 0 : total,
    firstDate: inv.issueDate,
    firstDescription: label,
    adjustDescription: inv.status === "VOID" ? `إلغاء: ${label}` : adjust,
  });
}

// ─── Commissions → therapist account (credit) ────────────────────────────────

/**
 * Keep the therapist account in line with a session's commission.
 * Call after a commission is created, changed or deleted. Keyed by session so a
 * deleted commission row is still reversed correctly.
 */
export async function syncCommissionLedger(tx: Tx, sessionId: string) {
  // A programme's commission is one entry for the whole programme, not one per session
  const owner = await tx.session.findUnique({ where: { id: sessionId }, select: { programId: true } });
  if (owner?.programId) return syncProgramCommissionLedger(tx, owner.programId);

  const [commission, session, postedAccounts] = await Promise.all([
    tx.therapistCommission.findUnique({
      where: { sessionId },
      select: { amount: true, therapistId: true, createdAt: true },
    }),
    tx.session.findUnique({
      where: { id: sessionId },
      select: {
        programSequenceNumber: true,
        patient: { select: { fullName: true } },
        service: { select: { name: true } },
      },
    }),
    tx.ledgerEntry.findMany({
      where: { sourceType: "COMMISSION", sourceId: sessionId },
      select: { accountId: true },
      distinct: ["accountId"],
    }),
  ]);

  const label =
    `عمولة جلسة — ${session?.patient.fullName ?? ""}` +
    (session?.service.name ? ` · ${session.service.name}` : "") +
    (session?.programSequenceNumber ? ` (#${session.programSequenceNumber})` : "");

  const currentAccount = commission ? await getTherapistAccountId(tx, commission.therapistId) : null;
  const accounts = new Set(postedAccounts.map((p) => p.accountId));
  if (currentAccount) accounts.add(currentAccount);

  for (const accountId of accounts) {
    const target = accountId === currentAccount && commission ? -r2(Number(commission.amount)) : 0;
    await syncSourceOnAccount(tx, {
      accountId,
      sourceType: "COMMISSION",
      sourceId: sessionId,
      targetNet: target,
      firstDate: commission?.createdAt ?? new Date(),
      firstDescription: label,
      adjustDescription: target === 0 ? `عكس ${label}` : `تعديل ${label}`,
    });
  }
}

/**
 * Programme commission → therapist account, as ONE entry for the programme
 * («عمولة برنامج … 12 جلسة × 25») plus one adjustment whenever the total changes
 * (programme ended early, cancelled, extended, a session deleted…).
 * The per-session commission rows still track what is earned and paid.
 */
export async function syncProgramCommissionLedger(tx: Tx, programId: string) {
  const [program, rows, postedAccounts] = await Promise.all([
    tx.program.findUnique({
      where: { id: programId },
      select: { patient: { select: { fullName: true } }, service: { select: { name: true } } },
    }),
    tx.therapistCommission.findMany({
      where: { session: { programId } },
      select: { therapistId: true, amount: true },
    }),
    tx.ledgerEntry.findMany({
      where: { sourceType: "COMMISSION", sourceId: programId },
      select: { accountId: true },
      distinct: ["accountId"],
    }),
  ]);
  if (!program) return;

  // A therapist transfer can split one programme between therapists
  const byAccount = new Map<string, { total: number; amounts: number[] }>();
  for (const r of rows) {
    const accountId = await getTherapistAccountId(tx, r.therapistId);
    const t = byAccount.get(accountId) ?? { total: 0, amounts: [] };
    t.total = r2(t.total + Number(r.amount));
    t.amounts.push(Number(r.amount));
    byAccount.set(accountId, t);
  }
  const accounts = new Set([...postedAccounts.map((p) => p.accountId), ...byAccount.keys()]);

  const base = `عمولة برنامج ${program.service.name} — ${program.patient.fullName}`;
  for (const accountId of accounts) {
    const t = byAccount.get(accountId) ?? { total: 0, amounts: [] };
    const n = t.amounts.length;
    const sameUnit = n > 0 && t.amounts.every((a) => Math.abs(a - t.amounts[0]) < EPS);
    await syncSourceOnAccount(tx, {
      accountId,
      sourceType: "COMMISSION",
      sourceId: programId,
      targetNet: -t.total,
      firstDate: new Date(),
      firstDescription: sameUnit ? `${base} — ${n} جلسة × ${r2(t.amounts[0])}` : `${base} — ${n} جلسة`,
      adjustDescription: n === 0 ? `عكس ${base}` : `تعديل ${base} — أصبحت ${n} جلسة بإجمالي ${t.total}`,
    });
  }
}

// ─── Vouchers ────────────────────────────────────────────────────────────────

/**
 * Every receipt and payment voucher names a payment method, and the method
 * decides which cash box or bank account the money moves through. The box is
 * copied onto the document so later changes to the method never move history.
 */
export async function resolvePaymentMethod(tx: Tx, paymentMethodId: string) {
  const method = await tx.paymentMethod.findUnique({
    where: { id: paymentMethodId },
    select: { id: true, name: true, isActive: true, cashAccountId: true, cashAccount: { select: { isActive: true, name: true } } },
  });
  if (!method) throw new LedgerError("طريقة الدفع غير موجودة");
  if (!method.isActive) throw new LedgerError(`طريقة الدفع «${method.name}» معطّلة`);
  if (!method.cashAccount.isActive) {
    throw new LedgerError(`الصندوق المرتبط بطريقة «${method.name}» (${method.cashAccount.name}) معطّل — عدّل الربط من «طرق الدفع»`);
  }
  return { id: method.id, name: method.name, cashAccountId: method.cashAccountId };
}

/** سند قبض — credits an account and brings cash into a cash box. */
export async function createReceipt(
  tx: Tx,
  d: {
    accountId: string;
    amount: number;
    paymentMethodId: string;
    paymentDate?: Date;
    referenceNumber?: string | null;
    notes?: string | null;
    description?: string | null;
    receivedBy: string;
  }
) {
  const amount = r2(d.amount);
  if (amount <= 0) throw new LedgerError("مبلغ سند القبض يجب أن يكون أكبر من صفر");
  const account = await requireActiveAccount(tx, d.accountId);
  if (account.kind === "CASH") {
    throw new LedgerError("لنقل المال بين الصناديق استخدم التسوية من نوع «تحويل»");
  }
  const method = await resolvePaymentMethod(tx, d.paymentMethodId);
  const date = d.paymentDate ?? new Date();
  const voucherNumber = await nextVoucherNumber(tx, "RECEIPT", date);

  const payment = await tx.payment.create({
    data: {
      voucherNumber,
      accountId: account.id,
      patientId: account.patientId,
      invoiceId: null,
      cashAccountId: method.cashAccountId,
      paymentMethodId: method.id,
      paymentDate: date,
      amount,
      referenceNumber: d.referenceNumber ?? null,
      receivedBy: d.receivedBy,
      notes: d.notes ?? null,
    },
  });

  await postEntry(tx, {
    accountId: account.id,
    date,
    credit: amount,
    description: d.description || (d.notes ? `سند قبض — ${d.notes}` : "سند قبض"),
    sourceType: "RECEIPT",
    sourceId: payment.id,
    reference: voucherNumber,
    createdBy: d.receivedBy,
  });

  // Second leg: the money lands in the cash box
  await postEntry(tx, {
    accountId: await getCashLedgerAccountId(tx, method.cashAccountId),
    date,
    debit: amount,
    description: `قبض من ${account.name}`,
    sourceType: "RECEIPT",
    sourceId: payment.id,
    reference: voucherNumber,
    createdBy: d.receivedBy,
  });

  return payment;
}

/** سند صرف — debits an account and takes cash out of a cash box. */
export async function createDisbursement(
  tx: Tx,
  d: {
    accountId: string;
    type: DisbursementType;
    amount: number;
    paymentMethodId: string;
    paymentDate?: Date;
    description: string;
    referenceNumber?: string | null;
    notes?: string | null;
    expenseCategory?: ExpenseCategory | null;
    issuedBy: string;
  }
) {
  const amount = r2(d.amount);
  if (amount <= 0) throw new LedgerError("مبلغ سند الصرف يجب أن يكون أكبر من صفر");
  const account = await requireActiveAccount(tx, d.accountId);
  if (account.kind === "CASH") {
    throw new LedgerError("لنقل المال بين الصناديق استخدم التسوية من نوع «تحويل»");
  }

  const method = await resolvePaymentMethod(tx, d.paymentMethodId);

  const date = d.paymentDate ?? new Date();
  const voucherNumber = await nextVoucherNumber(tx, "DISBURSEMENT", date);

  const disbursement = await tx.disbursement.create({
    data: {
      voucherNumber,
      type: d.type,
      accountId: account.id,
      cashAccountId: method.cashAccountId,
      paymentMethodId: method.id,
      amount,
      paymentDate: date,
      therapistId: account.therapistId,
      patientId: account.patientId,
      expenseCategory: d.expenseCategory ?? null,
      description: d.description,
      referenceNumber: d.referenceNumber ?? null,
      issuedBy: d.issuedBy,
      notes: d.notes ?? null,
    },
  });

  await postEntry(tx, {
    accountId: account.id,
    date,
    debit: amount,
    description: d.description,
    sourceType: "PAYMENT",
    sourceId: disbursement.id,
    reference: voucherNumber,
    createdBy: d.issuedBy,
  });

  // Second leg: the money leaves the cash box
  await postEntry(tx, {
    accountId: await getCashLedgerAccountId(tx, method.cashAccountId),
    date,
    credit: amount,
    description: `صرف إلى ${account.name} — ${d.description}`,
    sourceType: "PAYMENT",
    sourceId: disbursement.id,
    reference: voucherNumber,
    createdBy: d.issuedBy,
  });

  return disbursement;
}

/**
 * تسوية — a non-cash adjustment. Give one side (discount, write-off, correction)
 * or both sides (a transfer: debit one account, credit the other).
 */
export async function createSettlement(
  tx: Tx,
  d: {
    type: Prisma.SettlementCreateInput["type"];
    amount: number;
    date?: Date;
    debitAccountId?: string | null;
    creditAccountId?: string | null;
    description: string;
    notes?: string | null;
    issuedBy: string;
  }
) {
  const amount = r2(d.amount);
  if (amount <= 0) throw new LedgerError("مبلغ التسوية يجب أن يكون أكبر من صفر");
  if (!d.debitAccountId && !d.creditAccountId) throw new LedgerError("اختر حساباً واحداً على الأقل");
  if (d.debitAccountId && d.debitAccountId === d.creditAccountId) {
    throw new LedgerError("لا يمكن التحويل من حساب إلى نفسه");
  }
  if (d.debitAccountId) await requireActiveAccount(tx, d.debitAccountId);
  if (d.creditAccountId) await requireActiveAccount(tx, d.creditAccountId);

  const date = d.date ?? new Date();
  const voucherNumber = await nextVoucherNumber(tx, "SETTLEMENT", date);

  const settlement = await tx.settlement.create({
    data: {
      voucherNumber,
      type: d.type,
      date,
      amount,
      debitAccountId: d.debitAccountId ?? null,
      creditAccountId: d.creditAccountId ?? null,
      description: d.description,
      notes: d.notes ?? null,
      issuedBy: d.issuedBy,
    },
  });

  if (d.debitAccountId) {
    await postEntry(tx, {
      accountId: d.debitAccountId,
      date,
      debit: amount,
      description: `تسوية — ${d.description}`,
      sourceType: "SETTLEMENT",
      sourceId: settlement.id,
      reference: voucherNumber,
      createdBy: d.issuedBy,
    });
  }
  if (d.creditAccountId) {
    await postEntry(tx, {
      accountId: d.creditAccountId,
      date,
      credit: amount,
      description: `تسوية — ${d.description}`,
      sourceType: "SETTLEMENT",
      sourceId: settlement.id,
      reference: voucherNumber,
      createdBy: d.issuedBy,
    });
  }

  return settlement;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export type StatementEntry = {
  id: string;
  date: string;
  sourceType: LedgerSource;
  sourceId: string;
  reference: string | null;
  description: string;
  debit: number;
  credit: number;
  balance: number; // running, in the account's natural direction
  href: string | null; // the document behind the entry, when it has a page
};

/** كشف حساب — every entry of one account with a running balance. */
export async function getAccountStatement(db: Tx, accountId: string, from?: Date | null, to?: Date | null) {
  const account = await db.ledgerAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true, code: true, name: true, kind: true, nature: true, isActive: true, notes: true,
      patientId: true, therapistId: true, expenseCategory: true,
    },
  });
  if (!account) return null;

  const before = from
    ? await db.ledgerEntry.aggregate({
        where: { accountId, date: { lt: from } },
        _sum: { debit: true, credit: true },
      })
    : null;
  const broughtForward = naturalBalance(
    account.nature,
    Number(before?._sum.debit ?? 0),
    Number(before?._sum.credit ?? 0)
  );

  const rows = await db.ledgerEntry.findMany({
    where: {
      accountId,
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  const commissionIds = rows.filter((r) => r.sourceType === "COMMISSION").map((r) => r.sourceId);
  const programIds = new Set(
    commissionIds.length
      ? (await db.program.findMany({ where: { id: { in: commissionIds } }, select: { id: true } })).map((p) => p.id)
      : []
  );
  const hrefOf = (type: LedgerSource, id: string) =>
    type === "INVOICE" ? `/billing/${id}`
    : type === "COMMISSION" ? (programIds.has(id) ? `/programs/${id}` : `/sessions/${id}`)
    : null;

  let running = broughtForward;
  const entries: StatementEntry[] = rows.map((r) => {
    const debit = Number(r.debit);
    const credit = Number(r.credit);
    running = r2(running + naturalBalance(account.nature, debit, credit));
    return {
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      reference: r.reference,
      description: r.description,
      debit,
      credit,
      balance: running,
      href: hrefOf(r.sourceType, r.sourceId),
    };
  });

  const totalDebit = r2(entries.reduce((s, e) => s + e.debit, 0));
  const totalCredit = r2(entries.reduce((s, e) => s + e.credit, 0));

  return {
    account,
    broughtForward,
    entries,
    totals: {
      totalDebit,
      totalCredit,
      balance: r2(broughtForward + naturalBalance(account.nature, totalDebit, totalCredit)),
    },
  };
}

/** Balance of many accounts at once (optionally as of a date), keyed by account id. */
export async function getBalances(db: Tx, opts: { asOf?: Date | null; accountIds?: string[] } = {}) {
  const sums = await db.ledgerEntry.groupBy({
    by: ["accountId"],
    where: {
      ...(opts.accountIds ? { accountId: { in: opts.accountIds } } : {}),
      ...(opts.asOf ? { date: { lte: opts.asOf } } : {}),
    },
    _sum: { debit: true, credit: true },
  });
  return new Map(
    sums.map((s) => [s.accountId, { debit: Number(s._sum.debit ?? 0), credit: Number(s._sum.credit ?? 0) }])
  );
}

/**
 * Make sure every patient and therapist has a current account, so they can be
 * picked in a voucher before their first financial movement. Cheap when nothing
 * is missing (two lookups).
 */
export async function ensurePartyAccounts(tx: Tx): Promise<number> {
  const [patients, therapists] = await Promise.all([
    tx.patient.findMany({ where: { ledgerAccount: { is: null } }, select: { id: true } }),
    tx.therapist.findMany({ where: { ledgerAccount: { is: null } }, select: { id: true } }),
  ]);
  for (const p of patients) await getPatientAccountId(tx, p.id);
  for (const t of therapists) await getTherapistAccountId(tx, t.id);
  return patients.length + therapists.length;
}
