import { redirect } from "next/navigation";

/** The therapists list now lives in «الموظفون», filtered to therapists. */
export default function TherapistsPage() {
  redirect("/staff?type=therapists");
}
