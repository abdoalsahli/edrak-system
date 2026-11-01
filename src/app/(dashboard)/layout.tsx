import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TableCards } from "@/components/ui/TableCards";
import { BackButton } from "@/components/layout/BackButton";
import type { UserRole } from "@/lib/enums";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; name: string; role: UserRole };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="print:hidden"><Sidebar userRole={user.role} userName={user.name ?? ""} /></div>
      <main className="min-h-screen pt-14 duration-200 lg:pr-[var(--sidebar-w,16rem)] [html[data-sidebar-animate]_&]:transition-[padding] lg:pt-0 print:pr-0 print:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 print:p-0">
          <BackButton />
          {children}
        </div>
        <TableCards />
      </main>
    </div>
  );
}
