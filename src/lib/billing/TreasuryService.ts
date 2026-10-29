import { prisma } from "@/lib/prisma";
import type { AccountKind, AccountNature } from "@prisma/client";
import { getBalances, getCashLedgerAccountId, naturalBalance } from "@/lib/ledger/LedgerService";

/**
 * Treasury reporting — read entirely from the ledger.
 *
 * A cash box / bank is a ledger account (kind CASH, nature DEBIT), so its
 * balance and movement come from the same entries as every other account:
 *   receipt   → debit the box  (money in)
 *   payment   → credit the box (money out)
 *   transfer  → a settlement between two boxes
 *   opening   → the box's opening balance
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export type TreasuryEntry = {
  date: string; // YYYY-MM-DD
  type: "OPENING" | "RECEIPT" | "DISBURSEMENT" | "TRANSFER";
  voucherNumber: string;
  description: string;
  accountId: string; // the cash box id
  accountName: string;
  in: number;
  out: number;
  balance: number; // running balance across the selected boxes
  disbursementType: string | null;
  expenseCategory: string | null;
};

export type AccountMovement = {
  id: string; // cash box id
  ledgerAccountId: string;
  name: string;
  type: "CASH" | "BANK";
  isActive: boolean;
  broughtForward: number;
  totalIn: number;
  totalOut: number;
  closingBalance: number;
};

export type TreasuryMovement = {
  broughtForward: number;
  entries: TreasuryEntry[];
  totals: { totalIn: number; totalOut: number; closingBalance: number };
  byAccount: AccountMovement[];
  breakdown: {
    receipts: number;
    openings: number;
    transfersIn: number;
    transfersOut: number;
    byDisbursementType: Record<string, number>;
    byExpenseCategory: Record<string, number>;
  };
};

/** Every cash box with its ledger account id (created on first use). */
async function cashBoxes(boxIds?: string[]) {
  const boxes = await prisma.cashAccount.findMany({
    where: boxIds ? { id: { in: boxIds } } : {},
    orderBy: { createdAt: "asc" },
  });
  const ledgerIds = await prisma.$transaction(async (tx) => {
    const out: string[] = [];
    for (const b of boxes) out.push(await getCashLedgerAccountId(tx, b.id));
    return out;
  });
  return boxes.map((b, i) => ({ ...b, ledgerAccountId: ledgerIds[i] }));
}

/**
 * Every movement across the given cash boxes (all boxes when omitted)
 * within [from, to], with a balance brought forward from before `from`.
 */
export async function getTreasuryMovement(opts: {
  accountIds?: string[]; // cash box ids
  from?: Date | null;
  to?: Date | null;
}): Promise<TreasuryMovement> {
  const { from = null, to = null } = opts;
  const boxes = await cashBoxes(opts.accountIds);
  const byLedger = new Map(boxes.map((b) => [b.ledgerAccountId, b]));
  const ledgerIds = boxes.map((b) => b.ledgerAccountId);

  const before = from
    ? await getBalances(prisma, { accountIds: ledgerIds, asOf: new Date(from.getTime() - 1) })
    : new Map<string, { debit: number; credit: number }>();
  const bf = new Map(
    boxes.map((b) => {
      const t = before.get(b.ledgerAccountId) ?? { debit: 0, credit: 0 };
      return [b.ledgerAccountId, r2(t.debit - t.credit)];
    })
  );

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      accountId: { in: ledgerIds },
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  // What kind of payment each outflow was (commission, expense …)
  const paymentIds = rows.filter((r) => r.sourceType === "PAYMENT").map((r) => r.sourceId);
  const disbursements = paymentIds.length
    ? await prisma.disbursement.findMany({
        where: { id: { in: paymentIds } },
        select: { id: true, type: true, expenseCategory: true },
      })
    : [];
  const disbOf = new Map(disbursements.map((d) => [d.id, d]));

  const breakdown: TreasuryMovement["breakdown"] = {
    receipts: 0,
    openings: 0,
    transfersIn: 0,
    transfersOut: 0,
    byDisbursementType: {},
    byExpenseCategory: {},
  };
  const perBox = new Map(boxes.map((b) => [b.ledgerAccountId, { in: 0, out: 0 }]));

  let running = [...bf.values()].reduce((s, v) => s + v, 0);
  const broughtForward = r2(running);

  const entries: TreasuryEntry[] = rows.map((r) => {
    const box = byLedger.get(r.accountId)!;
    const inAmt = Number(r.debit);
    const outAmt = Number(r.credit);
    running += inAmt - outAmt;
    const acc = perBox.get(r.accountId)!;
    acc.in += inAmt;
    acc.out += outAmt;

    const type: TreasuryEntry["type"] =
      r.sourceType === "RECEIPT" ? "RECEIPT"
      : r.sourceType === "PAYMENT" ? "DISBURSEMENT"
      : r.sourceType === "OPENING" ? "OPENING"
      : "TRANSFER";

    const disb = r.sourceType === "PAYMENT" ? disbOf.get(r.sourceId) : undefined;
    if (type === "RECEIPT") breakdown.receipts += inAmt - outAmt;
    else if (type === "OPENING") breakdown.openings += inAmt - outAmt;
    else if (type === "TRANSFER") { breakdown.transfersIn += inAmt; breakdown.transfersOut += outAmt; }
    else if (disb) {
      breakdown.byDisbursementType[disb.type] = (breakdown.byDisbursementType[disb.type] ?? 0) + outAmt - inAmt;
      if (disb.type === "EXPENSE" && disb.expenseCategory) {
        breakdown.byExpenseCategory[disb.expenseCategory] =
          (breakdown.byExpenseCategory[disb.expenseCategory] ?? 0) + outAmt - inAmt;
      }
    }

    return {
      date: r.date.toISOString().slice(0, 10),
      type,
      voucherNumber: r.reference ?? "—",
      description: r.description,
      accountId: box.id,
      accountName: box.name,
      in: inAmt,
      out: outAmt,
      balance: r2(running),
      disbursementType: disb?.type ?? null,
      expenseCategory: disb?.expenseCategory ?? null,
    };
  });

  const totalIn = r2(entries.reduce((s, e) => s + e.in, 0));
  const totalOut = r2(entries.reduce((s, e) => s + e.out, 0));

  const byAccount: AccountMovement[] = boxes.map((b) => {
    const open = bf.get(b.ledgerAccountId) ?? 0;
    const mv = perBox.get(b.ledgerAccountId) ?? { in: 0, out: 0 };
    return {
      id: b.id,
      ledgerAccountId: b.ledgerAccountId,
      name: b.name,
      type: b.type,
      isActive: b.isActive,
      broughtForward: r2(open),
      totalIn: r2(mv.in),
      totalOut: r2(mv.out),
      closingBalance: r2(open + mv.in - mv.out),
    };
  });

  breakdown.receipts = r2(breakdown.receipts);
  breakdown.openings = r2(breakdown.openings);
  breakdown.transfersIn = r2(breakdown.transfersIn);
  breakdown.transfersOut = r2(breakdown.transfersOut);
  for (const k of Object.keys(breakdown.byDisbursementType)) breakdown.byDisbursementType[k] = r2(breakdown.byDisbursementType[k]);
  for (const k of Object.keys(breakdown.byExpenseCategory)) breakdown.byExpenseCategory[k] = r2(breakdown.byExpenseCategory[k]);

  return {
    broughtForward,
    entries,
    totals: { totalIn, totalOut, closingBalance: r2(broughtForward + totalIn - totalOut) },
    byAccount,
    breakdown,
  };
}

// ─── Account balances ────────────────────────────────────────────────────────

export type LedgerBalanceRow = {
  id: string;
  code: string;
  name: string;
  kind: AccountKind;
  nature: AccountNature;
  isActive: boolean;
  debit: number;
  credit: number;
  balance: number; // in the account's natural direction
};

export type CashAccountBalance = {
  id: string; // cash box id
  ledgerAccountId: string;
  name: string;
  type: "CASH" | "BANK";
  isActive: boolean;
  balance: number;
};

export type AccountBalances = {
  groups: Record<AccountKind, LedgerBalanceRow[]>;
  cashAccounts: CashAccountBalance[];
  totals: {
    receivable: number;       // patients who owe the centre
    patientCredit: number;    // patients the centre owes (overpaid)
    payable: number;          // therapists the centre owes
    therapistAdvance: number; // therapists paid ahead
    expenses: number;
    cash: number;
  };
};

/** Balance of every current account and every cash box as of `asOf`. */
export async function getAccountBalances(asOf: Date): Promise<AccountBalances> {
  const boxes = await cashBoxes();
  const [accounts, sums] = await Promise.all([
    prisma.ledgerAccount.findMany({ orderBy: { code: "asc" } }),
    getBalances(prisma, { asOf }),
  ]);

  const groups: Record<AccountKind, LedgerBalanceRow[]> = {
    PATIENT: [], THERAPIST: [], EXPENSE: [], CUSTOM: [], CASH: [],
  };
  for (const a of accounts) {
    const t = sums.get(a.id) ?? { debit: 0, credit: 0 };
    // Accounts that never moved add nothing — except custom ones and cash boxes
    if (t.debit === 0 && t.credit === 0 && a.kind !== "CUSTOM" && a.kind !== "CASH") continue;
    groups[a.kind].push({
      id: a.id,
      code: a.code,
      name: a.name,
      kind: a.kind,
      nature: a.nature,
      isActive: a.isActive,
      debit: r2(t.debit),
      credit: r2(t.credit),
      balance: naturalBalance(a.nature, t.debit, t.credit),
    });
  }
  for (const k of Object.keys(groups) as AccountKind[]) {
    if (k !== "CASH") groups[k].sort((x, y) => y.balance - x.balance);
  }

  const cashRow = new Map(groups.CASH.map((r) => [r.id, r]));
  const cashAccounts: CashAccountBalance[] = boxes.map((b) => ({
    id: b.id,
    ledgerAccountId: b.ledgerAccountId,
    name: b.name,
    type: b.type,
    isActive: b.isActive,
    balance: cashRow.get(b.ledgerAccountId)?.balance ?? 0,
  }));

  const pos = (rows: LedgerBalanceRow[]) => r2(rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0));
  const neg = (rows: LedgerBalanceRow[]) => r2(Math.abs(rows.filter((r) => r.balance < 0).reduce((s, r) => s + r.balance, 0)));

  return {
    groups,
    cashAccounts,
    totals: {
      receivable: pos(groups.PATIENT),
      patientCredit: neg(groups.PATIENT),
      payable: pos(groups.THERAPIST),
      therapistAdvance: neg(groups.THERAPIST),
      expenses: r2(groups.EXPENSE.reduce((s, r) => s + r.balance, 0)),
      cash: r2(cashAccounts.reduce((s, a) => s + a.balance, 0)),
    },
  };
}

/** Patients who owe the centre, largest balance first — read from the ledger. */
export async function getReceivables(limit?: number) {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { kind: "PATIENT" },
    select: { id: true, name: true, patientId: true, nature: true },
  });
  const sums = await getBalances(prisma, { accountIds: accounts.map((a) => a.id) });
  const rows = accounts
    .map((a) => {
      const t = sums.get(a.id) ?? { debit: 0, credit: 0 };
      return { accountId: a.id, patientId: a.patientId!, name: a.name, balance: naturalBalance(a.nature, t.debit, t.credit) };
    })
    .filter((r) => r.balance > 0.005)
    .sort((x, y) => y.balance - x.balance);
  return limit ? rows.slice(0, limit) : rows;
}

// ─── Dashboard widgets (read-only) ───────────────────────────────────────────

const MONTH_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

/** Money received and paid out per month, oldest month first. */
export async function getMonthlyFlow(months = 6) {
  const now = new Date();
  const ranges = Array.from({ length: months }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    return { start, end, label: MONTH_AR[start.getMonth()] };
  });
  const rows = await Promise.all(
    ranges.map(async ({ start, end }) => {
      const [inn, out] = await Promise.all([
        prisma.payment.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: start, lte: end } } }),
        prisma.disbursement.aggregate({ _sum: { amount: true }, where: { paymentDate: { gte: start, lte: end } } }),
      ]);
      return { received: r2(Number(inn._sum.amount ?? 0)), paid: r2(Number(out._sum.amount ?? 0)) };
    })
  );
  return {
    labels: ranges.map((r) => r.label),
    received: rows.map((r) => r.received),
    paid: rows.map((r) => r.paid),
  };
}

export type RecentDocument = {
  id: string;
  kind: "RECEIPT" | "PAYMENT" | "SETTLEMENT";
  voucherNumber: string;
  party: string;
  date: string; // YYYY-MM-DD
  amount: number; // signed: + money in, − money out, settlements unsigned
  createdAt: Date;
};

/** The latest receipts, payment vouchers and settlements, newest first. */
export async function getRecentDocuments(limit = 6): Promise<RecentDocument[]> {
  const [receipts, payments, settlements] = await Promise.all([
    prisma.payment.findMany({
      take: limit, orderBy: { createdAt: "desc" },
      select: { id: true, voucherNumber: true, paymentDate: true, amount: true, createdAt: true, account: { select: { name: true } }, patient: { select: { fullName: true } } },
    }),
    prisma.disbursement.findMany({
      take: limit, orderBy: { createdAt: "desc" },
      select: { id: true, voucherNumber: true, paymentDate: true, amount: true, createdAt: true, description: true, account: { select: { name: true } } },
    }),
    prisma.settlement.findMany({
      take: limit, orderBy: { createdAt: "desc" },
      select: {
        id: true, voucherNumber: true, date: true, amount: true, createdAt: true, description: true,
        debitAccount: { select: { name: true } }, creditAccount: { select: { name: true } },
      },
    }),
  ]);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const docs: RecentDocument[] = [
    ...receipts.map((r) => ({
      id: r.id, kind: "RECEIPT" as const, voucherNumber: r.voucherNumber, date: day(r.paymentDate), createdAt: r.createdAt,
      party: r.account?.name ?? r.patient?.fullName ?? "—", amount: Number(r.amount),
    })),
    ...payments.map((p) => ({
      id: p.id, kind: "PAYMENT" as const, voucherNumber: p.voucherNumber, date: day(p.paymentDate), createdAt: p.createdAt,
      party: p.account?.name ?? p.description, amount: -Number(p.amount),
    })),
    ...settlements.map((s) => ({
      id: s.id, kind: "SETTLEMENT" as const, voucherNumber: s.voucherNumber, date: day(s.date), createdAt: s.createdAt,
      party: s.creditAccount?.name ?? s.debitAccount?.name ?? s.description, amount: Number(s.amount),
    })),
  ];
  return docs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}
