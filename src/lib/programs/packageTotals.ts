/**
 * A program is agreed as a package: a total value and a total commission for
 * N sessions (e.g. 600 د.ل and 200 د.ل for 12 sessions). Per-session amounts are
 * only a split of those totals, so they are never multiplied back up — 200 / 12
 * is 16.67 a session, and 16.67 × 12 would charge 200.04.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Split a total into n amounts that add up to it exactly (cents go to the first ones). */
export function splitAmount(total: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  let remainder = cents - base * n;
  return Array.from({ length: n }, () => {
    const c = base + (remainder-- > 0 ? 1 : 0);
    return c / 100;
  });
}

type PricedSession = {
  programSequenceNumber: number | null;
  price: number | string | { toString(): string } | null;
  commissionAmount: number | string | { toString(): string } | null;
};

export type PackageTotals = { count: number; value: number; commission: number };

/**
 * The previous package of a program: its latest `packageSize` sessions (the
 * original package, or the last extension of the same size) with their agreed
 * value and commission. Repricing is reflected, since it changes those sessions.
 */
export function previousPackage(sessions: PricedSession[], packageSize: number): PackageTotals {
  const last = sessions
    .filter((s) => s.programSequenceNumber != null)
    .sort((a, b) => b.programSequenceNumber! - a.programSequenceNumber!)
    .slice(0, Math.max(1, packageSize));
  return {
    count: last.length,
    value: round2(last.reduce((t, s) => t + Number(s.price ?? 0), 0)),
    commission: round2(last.reduce((t, s) => t + Number(s.commissionAmount ?? 0), 0)),
  };
}

/**
 * What an extension of `added` sessions costs: the previous package's totals —
 * the same total when it is the same size, otherwise in proportion to it.
 */
export function extensionTotals(prev: PackageTotals, added: number): { value: number; commission: number } {
  if (prev.count === 0 || added <= 0) return { value: 0, commission: 0 };
  if (added === prev.count) return { value: prev.value, commission: prev.commission };
  return { value: round2((prev.value * added) / prev.count), commission: round2((prev.commission * added) / prev.count) };
}
