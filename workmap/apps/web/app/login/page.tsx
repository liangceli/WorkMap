import { MockLoginPanel } from "../../components/login/MockLoginPanel";

export default function LoginPage() {
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.copy}>
          <p style={styles.eyebrow}>WorkMap</p>
          <h1 style={styles.title}>Collaboration-first work visibility</h1>
          <p style={styles.subtitle}>
            A calm entry point for avatar presence, employee contact actions, and transparent manager summaries.
          </p>
          <div style={styles.privacyBox}>
            <strong>Privacy boundary</strong>
            <span>No keystrokes, screenshots, camera, microphone, message content, email body, or full URLs by default.</span>
          </div>
        </div>
        <MockLoginPanel />
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f3f7fb",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "24px",
    display: "grid",
    placeItems: "center",
  },
  shell: {
    width: "min(1040px, 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 430px",
    gap: "28px",
    alignItems: "center",
  },
  copy: {
    display: "grid",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "42px",
    lineHeight: 1.05,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "16px",
    lineHeight: 1.55,
  },
  privacyBox: {
    display: "grid",
    gap: "6px",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "14px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
};
