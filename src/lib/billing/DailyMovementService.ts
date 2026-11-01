import { prisma } from "@/lib/prisma";
import { getBalances } from "@/lib/ledger/LedgerService";

/**
 * كشف الحركة اليومية — every entry posted to any account in a period, one line
 * per document. A receipt posts two entries (the box and the patient); they are
 * shown together, from the credited account to the debited one. Automatic
 * adjustments (a program ended, a session repriced …) are their own lines, on
 * the day they changed the accounts.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export type MovementCategory = "INVOICE" | "COMMISSION" | "RECEIPT" | "PAYMENT" | "TRANSFER" | "SETTLEMENT" | "OPENING";

export const CATEGORY_LABEL: Record<MovementCategory, string> = {
  INVOICE: "قيمة الجلسات والبرامج",
  COMMISSION: "العمولات المرصودة",
  RECEIPT: "سندات القبض",
  PAYMENT: "سندات الصرف",
  TRANSFER: "التحويلات بين الصناديق",
  SETTLEMENT: "التسويات",
  OPENING: "الأرصدة الافتتاحية",
};
export const CATEGORY_ORDER: MovementCategory[] = ["INVOICE", "COMMISSION", "RECEIPT", "PAYMENT", "TRANSFER", "SETTLEMENT", "OPENING"];

export type MovementLine = {
  key: string;
  category: MovementCategory;
  date: string; // YYYY-MM-DD
  time: string; // ISO of when it was posted
  reference: string | null;
  description: string;
  /** Credited accounts → debited accounts */
  from: { id: string; name: string }[];
  to: { id: string; name: string }[];
  /** Positive amount; for charges and commissions a reduction is negative */
  amount: number;
  userName: string | null;
  href: string | null;
};

export type DailyMovement = {
  lines: MovementLine[];
  totals: {
    charges: number;
    commissions: number;
    receipts: number;
    payments: number;
    cashOpening: number;
    cashClosing: number;
  };
  byCategory: Record<MovementCategory, { count: number; amount: number }>;
  users: { id: string; name: string }[];
  boxes: { id: string; name: string }[];
};

export async function getDailyMovement(opts: {
  from: Date;
  to: Date;
  category?: MovementCategory | null;
  userId?: string | null;
  boxAccountId?: string | null; // ledger account id of a cash box
}): Promise<DailyMovement> {
  const { from, to } = opts;

  const rows = await prisma.ledgerEntry.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { account: { select: { id: true, name: true, kind: true } } },
  });

  // ── One line per document: its entries were written together ─────────────
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.sourceType}|${r.sourceId}|${Math.floor(r.createdAt.getTime() / 2000)}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  // Who issued each document (automatic entries carry no user of their own)
  const idsOf = (t: string) => [...new Set(rows.filter((r) => r.sourceType === t).map((r) => r.sourceId))];
  const [payments, disbursements, settlements, invoices, programs] = await Promise.all([
    prisma.payment.findMany({ where: { id: { in: idsOf("RECEIPT") } }, select: { id: true, receivedBy: true } }),
    prisma.disbursement.findMany({ where: { id: { in: idsOf("PAYMENT") } }, select: { id: true, issuedBy: true } }),
    prisma.settlement.findMany({ where: { id: { in: idsOf("SETTLEMENT") } }, select: { id: true, issuedBy: true } }),
    prisma.invoice.findMany({ where: { id: { in: idsOf("INVOICE") } }, select: { id: true, issuedBy: true } }),
    prisma.program.findMany({ where: { id: { in: idsOf("COMMISSION") } }, select: { id: true } }),
  ]);
  const issuer = new Map<string, string>([
    ...payments.map((p) => [p.id, p.receivedBy] as [string, string]),
    ...disbursements.map((d) => [d.id, d.issuedBy] as [string, string]),
    ...settlements.map((s) => [s.id, s.issuedBy] as [string, string]),
    ...invoices.map((i) => [i.id, i.issuedBy] as [string, string]),
  ]);
  const programIds = new Set(programs.map((p) => p.id));
  const userIds = [...new Set([...rows.map((r) => r.createdBy).filter((x): x is string => !!x), ...issuer.values()])];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  let lines: (MovementLine & { userId: string | null; accountIds: string[] })[] = [];
  for (const [key, g] of groups) {
    const first = g[0];
    const debitSide = g.filter((e) => Number(e.debit) > 0);
    const creditSide = g.filter((e) => Number(e.credit) > 0);
    const sumDebit = g.reduce((s, e) => s + Number(e.debit), 0);
    const sumCredit = g.reduce((s, e) => s + Number(e.credit), 0);
    const type = first.sourceType;

    const category: MovementCategory =
      type === "SETTLEMENT"
        ? g.length > 1 && g.every((e) => e.account.kind === "CASH") ? "TRANSFER" : "SETTLEMENT"
        : (type as MovementCategory);

    // Charges grow a patient's debt, commissions what a therapist is owed:
    // their adjustments can go either way, so they keep a sign
    const amount =
      category === "INVOICE" ? r2(sumDebit - sumCredit)
      : category === "COMMISSION" ? r2(sumCredit - sumDebit)
      : category === "OPENING" ? r2(Math.abs(sumDebit - sumCredit))
      : r2(Math.max(sumDebit, sumCredit));

    const userId = first.createdBy ?? issuer.get(first.sourceId) ?? null;
    const account = (e: (typeof g)[number]) => ({ id: e.account.id, name: e.account.name });
    lines.push({
      key,
      category,
      date: first.date.toISOString().slice(0, 10),
      time: first.createdAt.toISOString(),
      reference: first.reference,
      description: first.description,
      from: creditSide.map(account),
      to: debitSide.map(account),
      amount,
      userId,
      userName: userId ? userName.get(userId) ?? null : null,
      href:
        type === "INVOICE" ? `/billing/${first.sourceId}`
        : type === "COMMISSION" ? (programIds.has(first.sourceId) ? `/programs/${first.sourceId}` : `/sessions/${first.sourceId}`)
        : null,
      accountIds: g.map((e) => e.account.id),
    });
  }

  // Filter lists before narrowing, so the menus keep every choice
  const filterUsers = [...new Map(lines.filter((l) => l.userId && l.userName).map((l) => [l.userId!, l.userName!])).entries()]
    .map(([id, name]) => ({ id, name }));
  const cashAccounts = await prisma.ledgerAccount.findMany({ where: { kind: "CASH" }, select: { id: true, name: true }, orderBy: { code: "asc" } });

  if (opts.category) lines = lines.filter((l) => l.category === opts.category);
  if (opts.userId) lines = lines.filter((l) => l.userId === opts.userId);
  if (opts.boxAccountId) lines = lines.filter((l) => l.accountIds.includes(opts.boxAccountId!));

  const byCategory = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, { count: 0, amount: 0 }])) as DailyMovement["byCategory"];
  for (const l of lines) {
    byCategory[l.category].count++;
    byCategory[l.category].amount = r2(byCategory[l.category].amount + l.amount);
  }

  // Cash at the start and the end of the period (all boxes, or the chosen one)
  const boxIds = opts.boxAccountId ? [opts.boxAccountId] : cashAccounts.map((a) => a.id);
  const [before, after] = await Promise.all([
    getBalances(prisma, { accountIds: boxIds, asOf: new Date(from.getTime() - 1) }),
    getBalances(prisma, { accountIds: boxIds, asOf: to }),
  ]);
  const cash = (m: Map<string, { debit: number; credit: number }>) =>
    r2(boxIds.reduce((s, id) => { const t = m.get(id); return s + (t ? t.debit - t.credit : 0); }, 0));

  return {
    lines: lines.map(({ userId: _u, accountIds: _a, ...l }) => l),
    totals: {
      charges: byCategory.INVOICE.amount,
      commissions: byCategory.COMMISSION.amount,
      receipts: byCategory.RECEIPT.amount,
      payments: byCategory.PAYMENT.amount,
      cashOpening: cash(before),
      cashClosing: cash(after),
    },
    byCategory,
    users: filterUsers,
    boxes: cashAccounts,
  };
}
