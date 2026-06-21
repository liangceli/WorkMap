import { AppShell } from "../../../components/layout/AppShell";
import { WorkMapButton } from "../../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../../components/ui/WorkMapPrivacyNotice";
import { wmStyles } from "../../../lib/theme/workmapTheme";

export default function EmployeeDetailPage() {
  return (
    <AppShell>
      <section style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="People directory"
          title="Employee profile"
          subtitle="Employee detail pages require backend-backed profile data before they can show role-scoped summaries."
          actions={
            <>
              <WorkMapButton href="/employees">Employees</WorkMapButton>
              <WorkMapButton href="/virtual-office" tone="primary">Open office</WorkMapButton>
            </>
          }
        />
        <WorkMapPrivacyNotice title="Profile detail unavailable">
          This route no longer displays placeholder employee profiles. Use the directory and virtual-office contact drawer until the
          backend profile-detail view is connected for the signed-in workspace role.
        </WorkMapPrivacyNotice>
      </section>
    </AppShell>
  );
}

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
};
