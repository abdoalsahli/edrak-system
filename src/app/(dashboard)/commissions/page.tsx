import { redirect } from "next/navigation";

/** Commissions are now a report; payouts happen from each therapist's current account. */
export default function CommissionsRedirect() {
  redirect("/finance/reports/commissions");
}
