import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { PageHeader } from "@/components/ui/PageHeader";

/** Shared frame for the finance reports: role check, title and the period form. */
export async function requireFinanceRole() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role === "RECEPTIONIST") redirect("/dashboard");
}

export function defaultPeriod(sp: { from?: string; to?: string }) {
  const today = new Date();
  const fromIso = sp.from ?? format(startOfMonth(today), "yyyy-MM-dd");
  const toIso = sp.to ?? format(endOfMonth(today), "yyyy-MM-dd");
  return { fromIso, toIso, from: new Date(fromIso), to: new Date(toIso) };
}

export function ReportFrame({
  title, description, fromIso, toIso, asOfOnly = false, children,
}: {
  title: string;
  description?: string;
  fromIso?: string;
  toIso: string;
  asOfOnly?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <form method="get" className="flex flex-wrap items-end gap-2 mb-6">
        {!asOfOnly && (
          <div>
            <label className="label text-xs">من</label>
            <input type="date" name="from" defaultValue={fromIso} className="input" dir="ltr" />
          </div>
        )}
        <div>
          <label className="label text-xs">{asOfOnly ? "الأرصدة حتى تاريخ" : "إلى"}</label>
          <input type="date" name="to" defaultValue={toIso} className="input" dir="ltr" />
        </div>
        <button type="submit" className="btn-secondary">تطبيق</button>
      </form>
      {children}
    </div>
  );
}
