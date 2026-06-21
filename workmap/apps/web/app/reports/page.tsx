import { ReportSummaryPanel } from "../../components/reports/ReportSummaryPanel";
import { ReportsAccessGate } from "../../components/reports/ReportsAccessGate";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { AppShell } from "../../components/layout/AppShell";
import { wmStyles } from "../../lib/theme/workmapTheme";

export default function ReportsPage() {
  return (
    <AppShell>
      <ReportsAccessGate>
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

        <WorkMapPrivacyNotice title="Report privacy boundary">
          Reports show app names, domains, active time, and idle time only. Company summaries are aggregated by default; authorized employee-level
          access is audit logged. WorkMap never collects full URLs, message or email bodies, webpage content, form inputs, passwords, screenshots,
          screen recordings, keystrokes, clipboard, camera, or microphone data.
        </WorkMapPrivacyNotice>

        <ReportSummaryPanel />
        </section>
      </ReportsAccessGate>
    </AppShell>
  );
}

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
};
