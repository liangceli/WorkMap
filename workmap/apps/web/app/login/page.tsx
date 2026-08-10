import { CognitoLoginPanel } from "../../components/login/CognitoLoginPanel";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

export default function LoginPage() {
  return (
    <main className="wm-login-redesign" style={styles.page}>
      <section className="wm-login-shell" style={styles.shell}>
        <div className="wm-login-copy" style={styles.copy}>
          <p style={styles.eyebrow}>CandidGrid</p>
          <h1 style={styles.title}>Start with an Owner workspace, then invite your team</h1>
          <p style={styles.subtitle}>
            Create, confirm, and access your Cognito account without leaving CandidGrid. New teams begin with an Owner account; employees join only from an invitation link.
          </p>
          <div style={styles.privacyBox}>
            <strong>Monitoring boundary</strong>
            <span>CandidGrid does not collect screenshots or recordings; window or page titles or files; URL paths, queries or fragments; webpage, form or password content; key values or typed text; pointer details; clipboard; camera or microphone; or external private message, Teams or email body content. Employees should review the full product notice and their organisation&apos;s workplace monitoring notice before clients are paired.</span>
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
