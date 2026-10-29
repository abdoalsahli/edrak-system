"use client";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "gray";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary-100 text-primary-600",
  success: "bg-green-100 text-green-600",
  warning: "bg-amber-100 text-amber-600",
  danger: "bg-red-100 text-red-600",
  info: "bg-cyan-100 text-cyan-600",
  gray: "bg-gray-100 text-gray-500",
};

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
