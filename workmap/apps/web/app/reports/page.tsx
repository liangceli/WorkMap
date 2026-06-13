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
          title="Work summaries"
          subtitle="Review role-appropriate app and domain summaries with a clear privacy boundary."
          actions={
            <>
              <WorkMapButton href="/dashboard">Dashboard</WorkMapButton>
              <WorkMapButton href="/virtual-office">Open office</WorkMapButton>
              <WorkMapButton href="/compliance" tone="primary">Compliance</WorkMapButton>
            </>
          }
        />

        <WorkMapPrivacyNotice title="Pilot report boundary">
          Reports use the backend usage-summary API when an authenticated session is available. Sparse alpha data is expected;
          reports show app names, domains, active time, and idle time only, never full URLs, messages, screenshots, keystrokes,
          camera, or microphone data.
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
