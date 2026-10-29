import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import type { UserRole } from "@prisma/client";

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
      <main className="min-h-screen pr-64 print:pr-0">
        <div className="p-8 print:p-0">{children}</div>
      </main>
    </div>
  );
}
