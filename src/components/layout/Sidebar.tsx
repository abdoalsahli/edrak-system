"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutGrid, Users, CalendarDays, ClipboardList, Wallet, FileText, BookOpen, Landmark,
  UserCog, Layers, FileCheck2, BarChart3, Settings, CalendarCheck, NotebookText, LogOut, Briefcase, ChevronDown,
  type LucideIcon,
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

/** Pages kept together under one collapsible heading. */
type NavGroup = { key: string; label: string; icon: LucideIcon; children: NavLink[] };
type NavItem = NavLink | NavGroup;
const isGroup = (i: NavItem): i is NavGroup => "children" in i;

const FINANCE: UserRole[] = ["ACCOUNTANT", "MANAGER"];
const DESK: UserRole[] = ["RECEPTIONIST", "MANAGER"];

const NAV: NavItem[] = [
  // Therapist portal
  { href: "/my/schedule", label: "جدولي", icon: CalendarCheck, roles: ["THERAPIST"] },
  { href: "/my/plans", label: "خططي وتقاريري", icon: FileCheck2, roles: ["THERAPIST"] },
  { href: "/my/statement", label: "كشف حسابي", icon: NotebookText, roles: ["THERAPIST"] },

  { href: "/dashboard", label: "لوحة التحكم", icon: LayoutGrid, roles: ["RECEPTIONIST", "MANAGER", "ACCOUNTANT"] },
  { href: "/sessions", label: "الجلسات", icon: CalendarDays, roles: DESK },
  { href: "/patients", label: "الحالات", icon: Users, roles: DESK },
  { href: "/programs", label: "البرامج العلاجية", icon: ClipboardList, roles: DESK },
  { href: "/case-plans", label: "الخطط والتقارير", icon: FileCheck2, roles: ["MANAGER"], match: ["/programs/*/cycles"] },
  {
    key: "finance", label: "المالية", icon: Wallet,
    children: [
      { href: "/finance", label: "نظرة عامة", icon: Wallet, roles: FINANCE },
      {
        href: "/finance/receipts", label: "الحركات المالية", icon: FileText, roles: FINANCE,
        match: ["/finance/vouchers", "/finance/settlements", "/billing"],
      },
      { href: "/finance/accounts", label: "الحسابات الجارية", icon: BookOpen, roles: FINANCE, match: ["/patients/*/statement"] },
      {
        href: "/finance/cash", label: "الصناديق وطرق الدفع", icon: Landmark, roles: FINANCE,
        match: ["/finance/payment-methods", "/finance/cash-accounts"],
      },
    ],
  },
  {
    key: "admin", label: "الإدارة", icon: Briefcase,
    children: [
      { href: "/staff", label: "الموظفون", icon: UserCog, roles: ["MANAGER"], match: ["/therapists"] },
      { href: "/services", label: "الخدمات", icon: Layers, roles: ["MANAGER"] },
      {
        href: "/reports", label: "التقارير", icon: BarChart3, roles: ["MANAGER", "ACCOUNTANT"],
        match: ["/finance/reports", "/commissions"],
      },
    ],
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
 * link wins, so /finance/receipts highlights «الحركات المالية», not «نظرة عامة».
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

const OPEN_KEY = "edrak.sidebar.open";

/** Groups the user opened or closed, remembered per browser. */
function useOpenGroups() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try { setOpen(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}")); } catch { /* storage unavailable */ }
  }, []);
  const toggle = (key: string, value: boolean) => {
    setOpen((prev) => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };
  return [open, toggle] as const;
}

function NavLinks({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname();
  const [openGroups, toggle] = useOpenGroups();

  // What this role sees; a group with a single visible page shows as that page
  const items = NAV.flatMap((i): NavItem[] => {
    if (!isGroup(i)) return i.roles.includes(userRole) ? [i] : [];
    const children = i.children.filter((c) => c.roles.includes(userRole));
    if (children.length === 0) return [];
    if (children.length === 1) return [children[0]];
    return [{ ...i, children }];
  });

  const links = items.flatMap((i) => (isGroup(i) ? i.children : [i]));
  let activeHref: string | null = null;
  let best = 0;
  for (const l of links) {
    const s = matchScore(l, pathname);
    if (s > best) { best = s; activeHref = l.href; }
  }

  const renderLink = (l: NavLink, nested = false) => {
    const active = l.href === activeHref;
    const Icon = l.icon;
    return (
      <Link
        key={l.href}
        href={l.href}
        className={cn(
          "relative flex items-center gap-4 py-3 text-sm font-medium transition-colors",
          nested ? "pe-7 ps-12 py-2.5" : "px-7",
          active
            ? "text-primary-600 before:absolute before:inset-y-1 before:right-0 before:w-1.5 before:rounded-l-full before:bg-primary-600"
            : "text-gray-400 hover:text-primary-600"
        )}
      >
        {!nested && <Icon className="size-5 shrink-0" strokeWidth={1.8} />}
        <span>{l.label}</span>
      </Link>
    );
  };

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      {items.map((i) => {
        if (!isGroup(i)) return renderLink(i);
        const hasActive = i.children.some((c) => c.href === activeHref);
        // The group holding the current page is always open
        const open = hasActive || !!openGroups[i.key];
        const Icon = i.icon;
        return (
          <div key={i.key}>
            <button
              type="button"
              onClick={() => toggle(i.key, !open)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-4 px-7 py-3 text-sm font-medium transition-colors",
                hasActive ? "text-primary-600" : "text-gray-400 hover:text-primary-600"
              )}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.8} />
              <span className="flex-1 text-start">{i.label}</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {open && <div className="pb-1">{i.children.map((c) => renderLink(c, true))}</div>}
          </div>
        );
      })}
    </nav>
  );
}
