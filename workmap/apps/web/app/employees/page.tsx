import { EmployeeDirectory } from "../../components/employees/EmployeeDirectory";
import { employeeDirectoryRows } from "../../components/dashboard/mockDashboardData";
import { AppShell } from "../../components/layout/AppShell";

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
    display: "grid",
    gap: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 8px",
    fontSize: "34px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "15px",
  },
  nav: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  primaryLink: {
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 800,
  },
  secondaryLink: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 800,
  },
  privacyNote: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "12px 14px",
    fontSize: "14px",
  },
};
