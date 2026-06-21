import { CognitoLoginPanel } from "../../components/login/CognitoLoginPanel";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

export default function LoginPage() {
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.copy}>
          <p style={styles.eyebrow}>WorkMap</p>
          <h1 style={styles.title}>Start with an Owner workspace, then invite your team</h1>
          <p style={styles.subtitle}>
            Create, confirm, and access your Cognito account without leaving WorkMap. New teams begin with an Owner account; employees join only from an invitation link.
          </p>
          <div style={styles.privacyBox}>
            <strong>Privacy boundary</strong>
            <span>No keystrokes, screenshots, recordings, camera, microphone, message or email body, webpage body, form inputs, passwords, or full URL paths.</span>
          </div>
        </div>
        <CognitoLoginPanel />
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
    padding: "var(--wm-shell-block) var(--wm-shell-inline)",
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
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "40px",
    lineHeight: 1.15,
    fontWeight: 750,
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
