import { ReportSummaryPanel } from "../../components/reports/ReportSummaryPanel";
import { reportMetrics, reportRows } from "../../components/reports/mockReportsData";
import { AppShell } from "../../components/layout/AppShell";

export default function ReportsPage() {
  return (
    <AppShell>
      <section style={styles.shell}>
        <header style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Reports</p>
            <h1 style={styles.title}>Team summaries</h1>
            <p style={styles.subtitle}>
              Review high-level app, domain, active, and idle summaries without exposing private content.
            </p>
          </div>
          <nav style={styles.nav}>
            <a href="/dashboard" style={styles.secondaryLink}>Dashboard</a>
            <a href="/virtual-office" style={styles.secondaryLink}>Open office</a>
            <a href="/compliance" style={styles.primaryLink}>Compliance</a>
          </nav>
        </header>

        <section style={styles.notice}>
          <strong>Mock report data</strong>
          <span>
            Reports show aggregated app names and domains only. No full URLs, messages, emails, screenshots, keystrokes,
            camera, or microphone data.
          </span>
        </section>

        <ReportSummaryPanel metrics={reportMetrics} rows={reportRows} />
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
    lineHeight: 1.45,
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
  notice: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "12px 14px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
};
