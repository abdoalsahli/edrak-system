"use client";

import { useParams } from "next/navigation";
import { CycleWorkspace } from "@/components/casePlans/CycleWorkspace";

export default function ProgramCyclePage() {
  const { id, cycle } = useParams<{ id: string; cycle: string }>();
  return <CycleWorkspace programId={id} cycle={Number(cycle)} basePath={`/programs/${id}/cycles`} backHref={`/programs/${id}`} />;
}
