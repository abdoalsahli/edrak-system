import { BalancesReport } from "@/app/(dashboard)/reports/BalancesReport";
import { ReportFrame, defaultPeriod, requireFinanceRole } from "../ReportShell";

export default async function BalancesReportPage({ searchParams }: { searchParams: { to?: string } }) {
  await requireFinanceRole();
  const { to, toIso } = defaultPeriod(searchParams);
  return (
    <ReportFrame title="أرصدة الحسابات" description="رصيد كل حساب جارٍ وكل صندوق حتى تاريخ معيّن" toIso={toIso} asOfOnly>
      {await BalancesReport({ asOf: to, asOfIso: toIso })}
    </ReportFrame>
  );
}
