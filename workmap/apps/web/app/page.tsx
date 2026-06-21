import { wm, wmStyles } from "../lib/theme/workmapTheme";

export default function HomePage() {
  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <p style={styles.eyebrow}>WorkMap</p>
          <h1 style={styles.title}>Create the workspace first. Invite employees second.</h1>
          <p style={styles.subtitle}>
            WorkMap starts with a Cognito Owner account. After the Owner creates the workspace, employees join from secure invitation links
            and use Cognito for every future sign-in.
          </p>
          <section style={styles.privacyBox}>
            <strong>Transparent by design</strong>
            <span>
              App names and usage duration, browser domains and usage duration, device heartbeat, office presence, acknowledgement
              timestamps, and WorkMap messages or reactions may be collected. Screenshots, screen recordings, keystrokes, clipboard,
              webcam, microphone, external private messages, Teams or email body, webpage body, form inputs, passwords, and full URL paths are not collected.
            </span>
          </section>
        </div>

        <section style={styles.card}>
          <p style={styles.cardLabel}>Official entry</p>
          <h2 style={styles.cardTitle}>Start WorkMap</h2>
          <p style={styles.cardText}>
            New companies must begin with an Owner sign-up. Employees should use their invitation link first, then return here and sign in
            as an existing workspace user.
          </p>

          <div style={styles.actionGrid}>
            <a href="/login?mode=signup" style={styles.primaryButton}>
              Create Owner account
            </a>
            <a href="/login?mode=signin" style={styles.secondaryButton}>
              Sign in
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "var(--wm-shell-block) var(--wm-shell-inline)",
  },
  shell: {
    width: "min(1120px, 100%)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
    gap: "24px",
    alignItems: "center",
  },
  hero: {
    display: "grid",
    gap: "14px",
  },
  eyebrow: {
    margin: 0,
    color: wm.colors.secondary,
    fontSize: "13px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "46px",
    lineHeight: 1.12,
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
  card: {
    ...wmStyles.elevatedCard,
    alignSelf: "stretch",
    padding: "22px",
    display: "grid",
    alignContent: "center",
    gap: "14px",
  },
  cardLabel: {
    margin: 0,
    color: wm.colors.secondary,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  cardTitle: {
    margin: 0,
    color: wm.colors.textHeading,
    fontSize: "28px",
    lineHeight: 1.2,
  },
  cardText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    display: "grid",
    placeItems: "center",
    padding: "12px 14px",
    fontWeight: 900,
  },
  secondaryButton: {
    ...wmStyles.secondaryButton,
    display: "grid",
    placeItems: "center",
    padding: "12px 14px",
    fontWeight: 900,
  },
};
