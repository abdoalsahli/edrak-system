"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutGrid, Users, CalendarDays, ClipboardList, Wallet, FileText, BookOpen, Landmark,
  UserCog, Layers, FileCheck2, BarChart3, Settings, CalendarCheck, NotebookText, LogOut, Briefcase, ChevronDown, Menu, X, PanelRightClose, PanelRightOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/enums";

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
  // Below the lg breakpoint the sidebar is a drawer, opened from the top bar
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  // On large screens the sidebar can be folded to icons; the page margin follows
  const [collapsed, setCollapsed] = useState(false);
  // Read before the first paint, and animate only changes the user makes
  const [animate, setAnimate] = useState(false);
  useLayoutEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1"); } catch { /* storage unavailable */ }
    const id = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(id);
  }, []);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "5rem" : "16rem");
    document.documentElement.toggleAttribute("data-sidebar-animate", animate);
  }, [collapsed, animate]);
  function toggleCollapsed() {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1"); } catch { /* storage unavailable */ }
      return !c;
    });
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
    {/* Top bar — phones and tablets */}
    <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="فتح القائمة"
        className="grid size-10 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
      >
        <Menu className="size-6" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpg" alt="" className="size-8 object-contain" />
      <p className="font-bold text-gray-800">إدراك</p>
    </header>

    {open && <div className="fixed inset-0 z-40 bg-gray-800/40 lg:hidden" onClick={() => setOpen(false)} />}

    <aside
      className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col border-l border-gray-200 bg-white transition-transform duration-200 lg:z-40 lg:translate-x-0",
        animate && "lg:transition-[width]",
        collapsed ? "lg:w-20" : "lg:w-64",
        open ? "translate-x-0 shadow-xl" : "translate-x-full"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-20 items-center gap-3 px-7", collapsed && "lg:h-auto lg:flex-col lg:justify-center lg:gap-2 lg:px-0 lg:py-4")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="شعار مركز إدراك" className={cn("size-12 shrink-0 object-contain", collapsed && "lg:size-10")} />
        <div className={cn("min-w-0", collapsed && "lg:hidden")}>
          <p className="truncate text-lg font-bold leading-tight text-gray-800">إدراك</p>
          <p className="truncate text-xs text-gray-500">مركز التأهيل والاستشارات</p>
        </div>
        {/* Fold / unfold — large screens */}
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? "توسيع القائمة" : "طي القائمة"}
          aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"}
          className={cn("hidden size-9 shrink-0 place-items-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600 lg:grid", !collapsed && "ms-auto")}
        >
          {collapsed ? <PanelRightOpen className="size-5" strokeWidth={1.8} /> : <PanelRightClose className="size-5" strokeWidth={1.8} />}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق القائمة"
          className="ms-auto grid size-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100 lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>

      <Suspense fallback={<nav className="flex-1" />}>
        <NavLinks userRole={userRole} collapsed={collapsed} />
      </Suspense>


      {/* Signed-in user */}
      <div className={cn("border-t border-gray-200 px-6 py-4", collapsed && "lg:px-0")}>
        <div className={cn("flex items-center gap-3", collapsed && "lg:flex-col lg:gap-2")}>
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-primary font-bold text-white" title={userName}>
            {userName.charAt(0)}
          </div>
          <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
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
    </>
  );
}

const OPEN_KEY = "edrak.sidebar.open";
const COLLAPSED_KEY = "edrak.sidebar.collapsed";

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

function NavLinks({ userRole, collapsed }: { userRole: UserRole; collapsed: boolean }) {
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
        title={collapsed ? l.label : undefined}
        className={cn(
          "relative flex items-center gap-4 py-3 text-sm font-medium transition-colors",
          nested ? "pe-7 ps-12 py-2.5" : "px-7",
          collapsed && "lg:justify-center lg:px-0 lg:py-3",
          active
            ? "text-primary-600 before:absolute before:inset-y-1 before:right-0 before:w-1.5 before:rounded-l-full before:bg-primary-600"
            : "text-gray-400 hover:text-primary-600"
        )}
      >
        <Icon className={cn("size-5 shrink-0", nested && (collapsed ? "hidden lg:block" : "hidden"))} strokeWidth={1.8} />
        <span className={cn(collapsed && "lg:sr-only")}>{l.label}</span>
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
                hasActive ? "text-primary-600" : "text-gray-400 hover:text-primary-600",
                collapsed && "lg:hidden"
              )}
            >
              <Icon className="size-5 shrink-0" strokeWidth={1.8} />
              <span className="flex-1 text-start">{i.label}</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {/* Folded: the group's pages show as icons between two thin lines */}
            <div className={cn("pb-1", !open && (collapsed ? "hidden lg:block" : "hidden"), collapsed && "lg:my-1 lg:border-y lg:border-gray-100 lg:pb-0")}>
              {i.children.map((c) => renderLink(c, true))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
