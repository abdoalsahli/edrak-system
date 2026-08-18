"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "⊞", roles: ["RECEPTIONIST", "MANAGER", "ACCOUNTANT"] },
  { href: "/patients", label: "المرضى", icon: "👤", roles: ["RECEPTIONIST", "MANAGER"] },
  { href: "/sessions", label: "الجلسات", icon: "📋", roles: ["RECEPTIONIST", "MANAGER"] },
  { href: "/programs", label: "البرامج", icon: "📅", roles: ["RECEPTIONIST", "MANAGER"] },
  { href: "/billing",      label: "الفواتير والمدفوعات", icon: "💳", roles: ["ACCOUNTANT", "MANAGER"] },
  { href: "/commissions",  label: "العمولات",            icon: "💰", roles: ["ACCOUNTANT", "MANAGER"] },
  { href: "/therapists", label: "المعالجون", icon: "🏥", roles: ["MANAGER"] },
  { href: "/services", label: "الخدمات", icon: "⚕️", roles: ["MANAGER"] },
  { href: "/reports", label: "التقارير", icon: "📊", roles: ["MANAGER", "ACCOUNTANT"] },
  { href: "/settings", label: "الإعدادات", icon: "⚙️", roles: ["MANAGER"] },
];

const ROLE_LABELS: Record<UserRole, string> = {
  RECEPTIONIST: "موظف الاستقبال",
  MANAGER: "مدير",
  ACCOUNTANT: "محاسب",
};

type SidebarProps = {
  userRole: UserRole;
  userName: string;
};

export function Sidebar({ userRole, userName }: SidebarProps) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

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
