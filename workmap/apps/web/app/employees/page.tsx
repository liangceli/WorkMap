import { EmployeeDirectory } from "../../components/employees/EmployeeDirectory";
import { employeeDirectoryRows } from "../../components/dashboard/mockDashboardData";
import { AppShell } from "../../components/layout/AppShell";
import { wmStyles } from "../../lib/theme/workmapTheme";

export default function EmployeesPage() {
  return (
    <AppShell>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>People directory</p>
            <h1 style={styles.title}>Employees</h1>
            <p style={styles.subtitle}>Find teammates, check presence, and launch contact actions from one quiet workspace.</p>
          </div>
          <nav style={styles.nav}>
            <a href="/dashboard" style={styles.secondaryLink}>Dashboard</a>
            <a href="/virtual-office" style={styles.primaryLink}>Open office</a>
          </nav>
        </header>

        <section style={styles.privacyNote}>
          <strong>Privacy note</strong>
          <span>
            Employee view shows contact and presence details only. Manager summaries here are mock data until backend RBAC APIs are approved.
          </span>
        </section>

        <EmployeeDirectory employees={employeeDirectoryRows} />
      </section>
    </AppShell>
  );
}

const styles = {
  shell: {
    ...wmStyles.pageStack,
  },
  header: {
    ...wmStyles.pageHeader,
  },
  eyebrow: {
    ...wmStyles.eyebrow,
  },
  title: {
    ...wmStyles.pageTitle,
  },
  subtitle: {
    ...wmStyles.pageSubtitle,
  },
  nav: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  primaryLink: {
    ...wmStyles.primaryButton,
    padding: "10px 14px",
  },
  secondaryLink: {
    ...wmStyles.secondaryButton,
    padding: "10px 14px",
  },
  privacyNote: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    ...wmStyles.infoNotice,
    padding: "12px 14px",
    fontSize: "14px",
  },
};
