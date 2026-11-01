/**
 * The colour of an account balance: red when it stands on the debit side,
 * green on the credit side, black when it is zero. `balance` is in the
 * account's own direction (positive = the side of its nature).
 */
export function balanceTone(nature: string, balance: number): string {
  if (Math.abs(balance) < 0.005) return "text-gray-800";
  const debitSide = (nature === "DEBIT") === balance > 0;
  return debitSide ? "text-red-600" : "text-green-600";
}
