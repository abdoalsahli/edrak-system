import { redirect } from "next/navigation";

/** The cycles are listed on the program page. */
export default function ProgramCyclesPage({ params }: { params: { id: string } }) {
  redirect(`/programs/${params.id}`);
}
