"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/** Pages reached from the sidebar (or its tabs) — they need no back button. */
const TOP_LEVEL = new Set([
  "/dashboard", "/sessions", "/patients", "/programs", "/case-plans",
  "/finance", "/finance/receipts", "/finance/vouchers", "/finance/settlements", "/billing",
  "/finance/accounts", "/finance/cash", "/finance/payment-methods",
  "/staff", "/services", "/reports", "/finance/reports", "/finance/reports/balances",
  "/finance/reports/treasury", "/finance/reports/daily", "/finance/reports/commissions", "/settings",
  "/my/schedule", "/my/plans", "/my/statement",
]);

/** Inner pages whose URL parent is not a page of its own. */
const PARENT: [RegExp, string][] = [[/^\/finance\/cash-accounts\//, "/finance/cash"]];

/**
 * «رجوع» above every inner page: back in the browser history, or — when the
 * page was opened directly (a link, a new tab) — up to its parent page.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (TOP_LEVEL.has(pathname)) return null;

  function goBack() {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      router.back();
    } else {
      const parent =
        PARENT.find(([re]) => re.test(pathname))?.[1] ?? (pathname.split("/").slice(0, -1).join("/") || "/dashboard");
      router.push(parent);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="mb-3 inline-flex items-center gap-1.5 rounded-full py-1 text-sm font-medium text-gray-500 transition hover:text-primary-600 print:hidden"
    >
      <ArrowRight className="size-4" />
      رجوع
    </button>
  );
}
