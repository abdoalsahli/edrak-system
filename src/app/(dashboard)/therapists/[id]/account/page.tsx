import { redirect } from "next/navigation";

/** The therapist account now lives in the therapist's current account. */
export default function TherapistAccountRedirect({ params }: { params: { id: string } }) {
  redirect(`/finance/accounts/therapist:${params.id}`);
}
