import { UsageTable } from "./UsageTable";
import type { UsageRow } from "./mockDashboardData";

type AppUsageTableProps = {
  rows: UsageRow[];
};

export function AppUsageTable({ rows }: AppUsageTableProps) {
  return <UsageTable title="Top apps today" rows={rows} />;
}
