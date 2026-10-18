"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

type NavLink = {
  href: string; // may carry a query, e.g. "/reports?report=balances"
  label: string;
  icon: string;
  roles: UserRole[];
  section?: string; // a heading shown above this item inside a group
};

type NavGroup = {
  group: string;
  icon: string;
  roles: UserRole[];
  children: NavLink[];
};

type NavEntry = NavLink | NavGroup;

const FINANCE_ROLES: UserRole[] = ["ACCOUNTANT", "MANAGER"];

const NAV: NavEntry[] = [
  { href: "/my/schedule", label: "جدولي", icon: "🗓️", roles: ["THERAPIST"] },
  { href: "/dashboard", label: "لوحة التحكم", icon: "⊞", roles: ["RECEPTIONIST", "MANAGER", "ACCOUNTANT"] },
  { href: "/patients", label: "المرضى", icon: "👤", roles: ["RECEPTIONIST", "MANAGER"] },
  { href: "/sessions", label: "الجلسات", icon: "📋", roles: ["RECEPTIONIST", "MANAGER"] },
  { href: "/programs", label: "البرامج", icon: "📅", roles: ["RECEPTIONIST", "MANAGER"] },
  {
    group: "المالية",
    icon: "💼",
    roles: FINANCE_ROLES,
    children: [
      { href: "/finance", label: "لوحة المالية", icon: "📊", roles: FINANCE_ROLES },
      { href: "/finance/receipts", label: "سندات القبض", icon: "🧾", roles: FINANCE_ROLES, section: "المستندات" },
      { href: "/finance/vouchers", label: "سندات الصرف", icon: "📤", roles: FINANCE_ROLES },
      { href: "/finance/settlements", label: "التسويات", icon: "⇄", roles: FINANCE_ROLES },
      { href: "/billing", label: "الفواتير", icon: "💳", roles: FINANCE_ROLES },
      { href: "/finance/accounts", label: "الحسابات الجارية", icon: "📒", roles: FINANCE_ROLES, section: "الحسابات" },
      { href: "/finance/cash", label: "الصناديق والبنوك", icon: "🏦", roles: FINANCE_ROLES },
      { href: "/finance/payment-methods", label: "طرق الدفع", icon: "💱", roles: FINANCE_ROLES },
      { href: "/finance/reports/balances", label: "أرصدة الحسابات", icon: "⚖️", roles: FINANCE_ROLES, section: "التقارير" },
      { href: "/finance/reports/treasury", label: "حركة الخزينة", icon: "📈", roles: FINANCE_ROLES },
      { href: "/finance/reports/commissions", label: "عمولات الأخصائيين", icon: "👥", roles: FINANCE_ROLES },
    ],
  },
  { href: "/therapists", label: "المعالجون", icon: "🏥", roles: ["MANAGER"] },
  { href: "/services", label: "الخدمات", icon: "⚕️", roles: ["MANAGER"] },
  { href: "/reports", label: "التقارير", icon: "📊", roles: ["MANAGER", "ACCOUNTANT"] },
  { href: "/settings", label: "الإعدادات", icon: "⚙️", roles: ["MANAGER"] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  RECEPTIONIST: "موظف الاستقبال",
  MANAGER: "مدير",
  THERAPIST: "أخصائي",
  ACCOUNTANT: "محاسب",
};

const isGroup = (e: NavEntry): e is NavGroup => "group" in e;

/**
 * How well a link matches the current URL (0 = no match).
 * The most specific link wins, so /finance/receipts highlights "سندات القبض"
 * and not "الخزينة", and /reports?report=balances highlights "أرصدة الحسابات"
 * and not "التقارير".
 */
function matchScore(href: string, pathname: string, params: URLSearchParams): number {
  const [path, query] = href.split("?");
  const pathMatches =
    pathname === path || (path !== "/dashboard" && pathname.startsWith(path + "/"));
  if (!pathMatches) return 0;

  let score = path.length;
  if (query) {
    const wanted = new URLSearchParams(query);
    for (const [k, v] of wanted) {
      if (params.get(k) !== v) return 0;
    }
    score += 1000; // an exact query match beats the bare path
  }
  return score;
}

type SidebarProps = {
  userRole: UserRole;
  userName: string;
};

export function Sidebar({ userRole, userName }: SidebarProps) {
  return (
    <aside className="fixed top-0 right-0 h-full w-64 bg-white border-l border-gray-200 flex flex-col z-40">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">إ</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm truncate">مركز إدراك</p>
            <p className="text-xs text-gray-500 truncate">للتأهيل والاستشارات</p>
          </div>
        </div>
      </div>

      {/* Navigation — useSearchParams needs a Suspense boundary in the App Router */}
      <Suspense fallback={<nav className="flex-1 p-4" />}>
        <NavLinks userRole={userRole} />
      </Suspense>

      {/* User / Logout */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-gray-600 text-sm font-medium">{userName.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[userRole]}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-sm text-gray-500 hover:text-red-600 text-start py-1.5 transition-colors"
        >
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}

function NavLinks({ userRole }: { userRole: UserRole }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const entries = NAV.filter((e) => e.roles.includes(userRole)).map((e) =>
    isGroup(e) ? { ...e, children: e.children.filter((c) => c.roles.includes(userRole)) } : e
  );

  // Find the single most specific active link across the whole menu
  const allLinks = entries.flatMap((e) => (isGroup(e) ? e.children : [e]));
  let activeHref: string | null = null;
  let best = 0;
  for (const l of allLinks) {
    const s = matchScore(l.href, pathname, searchParams);
    if (s > best) {
      best = s;
      activeHref = l.href;
    }
  }

  return (
    <nav className="flex-1 overflow-y-auto p-4 space-y-1">
      {entries.map((e) =>
        isGroup(e) ? (
          <NavGroupItem key={e.group} group={e} activeHref={activeHref} />
        ) : (
          <NavLinkItem key={e.href} link={e} active={activeHref === e.href} />
        )
      )}
    </nav>
  );
}

function NavLinkItem({ link, active, nested = false }: { link: NavLink; active: boolean; nested?: boolean }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 rounded-lg font-medium transition-colors",
        nested ? "px-3 py-2 text-[13px]" : "px-3 py-2.5 text-sm",
        active ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
    >
      <span className={nested ? "text-sm" : "text-base"}>{link.icon}</span>
      <span>{link.label}</span>
    </Link>
  );
}

const STORAGE_KEY = "sidebar-open-groups";

function NavGroupItem({ group, activeHref }: { group: NavGroup; activeHref: string | null }) {
  const containsActive = group.children.some((c) => c.href === activeHref);
  const [open, setOpen] = useState(containsActive);

  // Remember the user's choice between page loads
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
      if (saved[group.group] !== undefined) setOpen(saved[group.group] || containsActive);
    } catch {
      /* storage unavailable — keep default */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Always reveal the group when navigating into one of its screens
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, boolean>;
      saved[group.group] = next;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }

  if (group.children.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          containsActive && !open ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
      >
        <span className="text-base">{group.icon}</span>
        <span className="flex-1 text-start">{group.group}</span>
        <span className={cn("text-xs text-gray-400 transition-transform", open ? "rotate-180" : "")}>▾</span>
      </button>

      {open && (
        <div className="mt-1 ms-4 ps-2 border-s border-gray-100 space-y-0.5">
          {group.children.map((c) => (
            <div key={c.href}>
              {c.section && (
                <p className="px-3 pt-3 pb-1 text-[11px] font-semibold text-gray-400">{c.section}</p>
              )}
              <NavLinkItem link={c} active={activeHref === c.href} nested />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
