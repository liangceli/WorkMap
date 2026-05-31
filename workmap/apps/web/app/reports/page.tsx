import { ReportSummaryPanel } from "../../components/reports/ReportSummaryPanel";
import { reportMetrics, reportRows } from "../../components/reports/mockReportsData";
import { AppShell } from "../../components/layout/AppShell";
import { wmStyles } from "../../lib/theme/workmapTheme";

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
  notice: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
    ...wmStyles.infoNotice,
    padding: "12px 14px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
};
