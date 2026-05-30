import { ManagerOverviewPanel } from "../../components/dashboard/ManagerOverviewPanel";
import { AppShell } from "../../components/layout/AppShell";

export default function DashboardPage() {
  return (
    <AppShell>
      <ManagerOverviewPanel />
    </AppShell>
  );
}
