import { redirect } from "next/navigation";

/** The patient statement now lives in the patient's current account. */
export default function PatientStatementRedirect({ params }: { params: { id: string } }) {
  redirect(`/finance/accounts/patient:${params.id}`);
}
