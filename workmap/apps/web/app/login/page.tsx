import { MockLoginPanel } from "../../components/login/MockLoginPanel";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

export default function LoginPage() {
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.copy}>
          <p style={styles.eyebrow}>WorkMap</p>
          <h1 style={styles.title}>Transparent work visibility for hybrid teams</h1>
          <p style={styles.subtitle}>
            Sign in to a workspace where presence, contact actions, activity summaries, and compliance boundaries stay understandable.
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
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "24px",
    display: "grid",
    placeItems: "center",
  },
  shell: {
    width: "min(1040px, 100%)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: "28px",
    alignItems: "center",
  },
  copy: {
    display: "grid",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    color: wm.colors.secondary,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "40px",
    lineHeight: 1.2,
    fontWeight: 700,
    letterSpacing: 0,
  },
  subtitle: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "18px",
    lineHeight: 1.55,
  },
  privacyBox: {
    display: "grid",
    gap: "6px",
    ...wmStyles.infoNotice,
    padding: "14px",
    fontSize: "14px",
    lineHeight: 1.45,
  },
};
