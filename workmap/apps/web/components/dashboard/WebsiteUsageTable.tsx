import { UsageTable } from "./UsageTable";
import type { UsageRow } from "./mockDashboardData";

type WebsiteUsageTableProps = {
  rows: UsageRow[];
};

export function WebsiteUsageTable({ rows }: WebsiteUsageTableProps) {
  return <UsageTable title="Top domains today" rows={rows} />;
}
