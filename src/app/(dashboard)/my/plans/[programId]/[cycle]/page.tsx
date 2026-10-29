"use client";

import { useParams } from "next/navigation";
import { CycleWorkspace } from "@/components/casePlans/CycleWorkspace";

export default function MyCyclePage() {
  const { programId, cycle } = useParams<{ programId: string; cycle: string }>();
  return <CycleWorkspace programId={programId} cycle={Number(cycle)} basePath={`/my/plans/${programId}`} backHref="/my/plans" />;
}
