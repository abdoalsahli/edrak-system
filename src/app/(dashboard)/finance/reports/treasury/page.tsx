import { TreasuryReport } from "@/app/(dashboard)/reports/TreasuryReport";
import { ReportFrame, defaultPeriod, requireFinanceRole } from "../ReportShell";

export default async function TreasuryReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  await requireFinanceRole();
  const { from, to, fromIso, toIso } = defaultPeriod(searchParams);
  return (
    <ReportFrame title="حركة الخزينة" description="كل ما دخل الصناديق وخرج منها خلال فترة" fromIso={fromIso} toIso={toIso}>
      {await TreasuryReport({ from, to, fromIso, toIso })}
    </ReportFrame>
  );
}
