import { ReportSummaryPanel } from "../../components/reports/ReportSummaryPanel";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { AppShell } from "../../components/layout/AppShell";
import { reportMetrics, reportRows } from "../../lib/mock/mockReports";
import { wmStyles } from "../../lib/theme/workmapTheme";

export default function ReportsPage() {
  return (
    <AppShell>
      <section style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="Reports"
          title="Team summaries"
          subtitle="Review high-level app, domain, active, and idle summaries without exposing private content."
          actions={
            <>
              <WorkMapButton href="/dashboard">Dashboard</WorkMapButton>
              <WorkMapButton href="/virtual-office">Open office</WorkMapButton>
              <WorkMapButton href="/compliance" tone="primary">Compliance</WorkMapButton>
            </>
          }
        />

        <WorkMapPrivacyNotice title="Pilot report boundary">
          Reports use the existing backend usage-summary API when an authenticated pilot session is available. Sparse pilot
          data is expected; reports still show app names and domains only, never full URLs, messages, screenshots,
          keystrokes, camera, or microphone data.
        </WorkMapPrivacyNotice>

        <ReportSummaryPanel metrics={reportMetrics} rows={reportRows} />
      </section>
    </AppShell>
  );
}

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
};
