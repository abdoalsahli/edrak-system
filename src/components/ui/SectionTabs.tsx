"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SectionTab = { href: string; label: string };

/** Screens shown together under one sidebar item, as underlined tabs. */
export const DOCUMENT_TABS: SectionTab[] = [
  { href: "/finance/receipts", label: "سندات القبض" },
  { href: "/finance/vouchers", label: "سندات الصرف" },
  { href: "/finance/settlements", label: "التسويات" },
  { href: "/billing", label: "الفواتير" },
];

export const FUNDS_TABS: SectionTab[] = [
  { href: "/finance/cash", label: "الصناديق والبنوك" },
  { href: "/finance/payment-methods", label: "طرق الدفع" },
];

export const REPORT_TABS: SectionTab[] = [
  { href: "/reports", label: "التقارير العامة" },
  { href: "/finance/reports/daily", label: "الحركة اليومية" },
  { href: "/finance/reports/balances", label: "أرصدة الحسابات" },
  { href: "/finance/reports/treasury", label: "حركة الخزينة" },
  { href: "/finance/reports/commissions", label: "عمولات الأخصائيين" },
];

export function SectionTabs({ tabs, className }: { tabs: SectionTab[]; className?: string }) {
  const pathname = usePathname();
  // The longest matching tab wins (/billing/123 still highlights «الفواتير»)
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className={cn("mb-6 flex gap-6 overflow-x-auto overflow-y-hidden border-b border-gray-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "relative whitespace-nowrap pb-3 text-sm font-medium transition-colors",
            t.href === active
              ? "text-primary-600 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary-600"
              : "text-gray-500 hover:text-gray-800"
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
