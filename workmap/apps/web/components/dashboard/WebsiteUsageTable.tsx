import { UsageTable } from "./UsageTable";
import type { UsageRow } from "./mockDashboardData";

type WebsiteUsageTableProps = {
  rows: UsageRow[];
  title?: string;
};

export function WebsiteUsageTable({ rows, title = "Top domains today" }: WebsiteUsageTableProps) {
  return <UsageTable title={title} rows={rows} />;
}
