import { EmployeeDirectory } from "../../components/employees/EmployeeDirectory";
import { WorkMapButton } from "../../components/ui/WorkMapButton";
import { WorkMapPageHeader } from "../../components/ui/WorkMapPageHeader";
import { WorkMapPrivacyNotice } from "../../components/ui/WorkMapPrivacyNotice";
import { AppShell } from "../../components/layout/AppShell";
import { employeeDirectoryRows } from "../../lib/mock/mockPeople";
import { wmStyles } from "../../lib/theme/workmapTheme";

export default function EmployeesPage() {
  return (
    <AppShell>
      <section style={styles.shell}>
        <WorkMapPageHeader
          eyebrow="People directory"
          title="Employees"
          subtitle="Find teammates, check presence, and launch contact actions from one quiet workspace."
          actions={
            <>
              <WorkMapButton href="/dashboard">Dashboard</WorkMapButton>
              <WorkMapButton href="/virtual-office" tone="primary">Open office</WorkMapButton>
            </>
          }
        />

        <WorkMapPrivacyNotice title="Privacy note">
          Employee view shows contact and presence details only. Manager summaries here are mock data until backend RBAC APIs are approved.
        </WorkMapPrivacyNotice>

        <EmployeeDirectory employees={employeeDirectoryRows} />
      </section>
    </AppShell>
  );
}

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
};
