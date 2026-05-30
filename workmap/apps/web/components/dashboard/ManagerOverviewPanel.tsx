import { EmployeeCard } from "./EmployeeCard";
import { AppUsageTable } from "./AppUsageTable";
import { PrivacyNoticeCard } from "./PrivacyNoticeCard";
import { UsageSummaryCard } from "./UsageSummaryCard";
import { WebsiteUsageTable } from "./WebsiteUsageTable";
import { appUsageRows, dashboardEmployees, usageMetrics, websiteUsageRows } from "./mockDashboardData";

export function ManagerOverviewPanel() {
  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Manager dashboard</p>
          <h1 style={styles.title}>Team visibility without the surveillance feel</h1>
          <p style={styles.subtitle}>Review presence, collaboration readiness, and high-level work patterns for today.</p>
        </div>
        <div style={styles.heroActions}>
          <a href="/virtual-office" style={styles.officeLink}>Open office</a>
          <a href="/employees" style={styles.secondaryLink}>View employees</a>
          <a href="/reports" style={styles.secondaryLink}>View reports</a>
          <a href="/compliance" style={styles.secondaryLink}>Review compliance</a>
          <a href="/integrations" style={styles.secondaryLink}>Manage integrations</a>
        </div>
      </section>

      <section style={styles.metricGrid}>
        {usageMetrics.map((metric) => (
          <UsageSummaryCard key={metric.label} metric={metric} />
        ))}
      </section>

      <div style={styles.contentGrid}>
        <section style={styles.panel}>
          <h2 style={styles.panelTitle}>People nearby</h2>
          <div style={styles.employeeGrid}>
            {dashboardEmployees.map((employee) => (
              <EmployeeCard key={employee.id} employee={employee} />
            ))}
          </div>
        </section>

        <aside style={styles.sideStack}>
          <PrivacyNoticeCard />
          <AppUsageTable rows={appUsageRows} />
          <WebsiteUsageTable rows={websiteUsageRows} />
        </aside>
      </div>
    </div>
  );
}

const styles = {
  stack: {
    display: "grid",
    gap: "18px",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "20px",
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
    fontSize: "30px",
    lineHeight: 1.1,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "15px",
  },
  officeLink: {
    flex: "0 0 auto",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 14px",
    textDecoration: "none",
    fontWeight: 800,
  },
  heroActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  secondaryLink: {
    flex: "0 0 auto",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 12px",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 800,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "12px",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    gap: "16px",
    alignItems: "start",
  },
  panel: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
  },
  panelTitle: {
    margin: "0 0 12px",
    fontSize: "18px",
  },
  employeeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "12px",
  },
  sideStack: {
    display: "grid",
    gap: "12px",
  },
};
