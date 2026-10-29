import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "primary" | "success" | "warning" | "danger" | "info";

const TONES: Record<StatTone, string> = {
  primary: "bg-primary-100 text-primary-600",
  success: "bg-green-100 text-green-500",
  warning: "bg-amber-100 text-amber-500",
  danger: "bg-red-100 text-red-500",
  info: "bg-cyan-100 text-cyan-500",
};

/** A figure with its tinted icon circle — the dashboards' building block. */
export function StatCard({
  label, value, icon: Icon, tone = "primary", hint, className,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card flex items-center gap-4 p-5", className)}>
      <div className={cn("grid size-14 shrink-0 place-items-center rounded-full", TONES[tone])}>
        <Icon className="size-6" strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-800" dir="auto">{value}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}
