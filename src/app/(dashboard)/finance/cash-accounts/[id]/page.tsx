import { redirect } from "next/navigation";

/** A cash box is a ledger account: its statement is the unified account statement. */
export default function CashStatementRedirect({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const qs = new URLSearchParams();
  if (searchParams.from) qs.set("from", searchParams.from);
  if (searchParams.to) qs.set("to", searchParams.to);
  const q = qs.toString();
  redirect(`/finance/accounts/cash:${params.id}${q ? `?${q}` : ""}`);
}
