"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutGrid, Users, CalendarDays, ClipboardList, Wallet, FileText, BookOpen, Landmark,
  UserCog, Layers, BarChart3, Settings, CalendarCheck, NotebookText, LogOut, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  /** Other screens that belong to this item (it stays highlighted on them). */
  match?: string[];
};

const FINANCE: UserRole[] = ["ACCOUNTANT", "MANAGER"];
const DESK: UserRole[] = ["RECEPTIONIST", "MANAGER"];

const NAV: NavLink[] = [
  // Therapist portal
  { href: "/my/schedule", label: "جدولي", icon: CalendarCheck, roles: ["THERAPIST"] },
  { href: "/my/statement", label: "كشف حسابي", icon: NotebookText, roles: ["THERAPIST"] },

  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutGrid, roles: ["RECEPTIONIST", "MANAGER", "ACCOUNTANT"] },
  { href: "/patients", label: "المرضى", icon: Users, roles: DESK },
  { href: "/sessions", label: "الجلسات", icon: CalendarDays, roles: DESK },
  { href: "/programs", label: "البرامج العلاجية", icon: ClipboardList, roles: DESK },
  { href: "/finance", label: "المالية", icon: Wallet, roles: FINANCE },
  {
    href: "/finance/receipts", label: "السندات والتسويات", icon: FileText, roles: FINANCE,
    match: ["/finance/vouchers", "/finance/settlements", "/billing"],
  },
  { href: "/finance/accounts", label: "الحسابات الجارية", icon: BookOpen, roles: FINANCE, match: ["/patients/*/statement"] },
  {
    href: "/finance/cash", label: "الصناديق وطرق الدفع", icon: Landmark, roles: FINANCE,
    match: ["/finance/payment-methods", "/finance/cash-accounts"],
  },
  { href: "/staff", label: "الموظفون", icon: UserCog, roles: ["MANAGER"], match: ["/therapists"] },
  { href: "/services", label: "الخدمات", icon: Layers, roles: ["MANAGER"] },
  {
    href: "/reports", label: "التقارير", icon: BarChart3, roles: ["MANAGER", "ACCOUNTANT"],
    match: ["/finance/reports", "/commissions"],
  },
  { href: "/settings", label: "الإعدادات", icon: Settings, roles: ["MANAGER"] },
];

export const ROLE_LABELS: Record<UserRole, string> = {
  RECEPTIONIST: "موظف الاستقبال",
  MANAGER: "مدير",
  THERAPIST: "أخصائي",
  ACCOUNTANT: "محاسب",
};

/** Does `pattern` (a path, `*` = one segment) cover `pathname` or one of its sub-pages? */
function covers(pattern: string, pathname: string): boolean {
  const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+") + "(/.*)?$");
  return re.test(pathname);
}

/**
 * How well a link matches the current URL (0 = no match). The most specific
 * link wins, so /finance/receipts highlights «السندات والتسويات», not «المالية».
 */
function matchScore(link: NavLink, pathname: string): number {
  let best = 0;
  for (const p of [link.href, ...(link.match ?? [])]) {
    const exactOnly = p === "/dashboard";
    if (exactOnly ? pathname === p : covers(p, pathname)) best = Math.max(best, p.length);
  }
  return best;
}

export function Sidebar({ userRole, userName }: { userRole: UserRole; userName: string }) {
  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 px-7">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="شعار مركز إدراك" className="size-12 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold leading-tight text-gray-800">إدراك</p>
          <p className="truncate text-xs text-gray-500">مركز التأهيل والاستشارات</p>
        </div>
      </div>

      <Suspense fallback={<nav className="flex-1" />}>
        <NavLinks userRole={userRole} />
      </Suspense>

      {/* Signed-in user */}
      <div className="border-t border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-primary font-bold text-white">
            {userName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-800">{userName}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[userRole]}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="grid size-9 shrink-0 place-items-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavLinks({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname();
  const links = NAV.filter((l) => l.roles.includes(userRole));

  let activeHref: string | null = null;
  let best = 0;
  for (const l of links) {
    const s = matchScore(l, pathname);
    if (s > best) { best = s; activeHref = l.href; }
  }

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      {links.map((l) => {
        const active = l.href === activeHref;
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "relative flex items-center gap-4 px-7 py-3 text-sm font-medium transition-colors",
              active
                ? "text-primary-600 before:absolute before:inset-y-1 before:right-0 before:w-1.5 before:rounded-l-full before:bg-primary-600"
                : "text-gray-400 hover:text-primary-600"
            )}
          >
            <Icon className="size-5 shrink-0" strokeWidth={1.8} />
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
