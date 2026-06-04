import { UsageTable } from "./UsageTable";
import type { UsageRow } from "./mockDashboardData";

type AppUsageTableProps = {
  rows: UsageRow[];
  title?: string;
};

export function AppUsageTable({ rows, title = "Top apps today" }: AppUsageTableProps) {
  return <UsageTable title={title} rows={rows} />;
}
