import { ReportSummaryPanel } from "../../components/reports/ReportSummaryPanel";
import { ReportsAccessGate } from "../../components/reports/ReportsAccessGate";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { AppShell } from "../../components/layout/AppShell";
import { wmStyles } from "../../lib/theme/workmapTheme";

export default function ReportsPage() {
  return (
    <AppShell variant="editorial">
      <ReportsAccessGate>
        <section className="wm-redesign-page wm-reports-page" style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="Reports"
          title="Work summaries"
          subtitle="Review role-permitted app and domain summaries within your organisation."
          actions={
            <>
              <WorkMapButton href="/dashboard">Dashboard</WorkMapButton>
              <WorkMapButton href="/virtual-office">Open office</WorkMapButton>
              <WorkMapButton href="/compliance" tone="primary">Monitoring notice</WorkMapButton>
            </>
          }
        />

        <WorkMapPrivacyNotice title="Report privacy boundary">
          Reports show App names, HTTP/HTTPS hostnames, Focus active time, focused idle time and separately labelled App or Domain open/runtime context when enabled. The current Reports page is not exposed to the Employee role; an Employee&apos;s backend report scope remains limited to their own activity. Team Leads, Managers, HR Admins and Owners can view role-permitted team or employee activity within their organisation, and employee-level access is audit logged. IT Admins can access only their own report scope and do not receive another employee&apos;s activity through that role. Platform Admin does not receive tenant employee activity views. CandidGrid does not collect URL paths, queries or fragments, window or page titles, files, webpage or form content, passwords, screenshots or recordings, key values or typed text, pointer details, clipboard, camera, microphone, or external private message, Teams or email body content.
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
