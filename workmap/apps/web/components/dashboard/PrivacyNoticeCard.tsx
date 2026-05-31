import { wm, wmStyles } from "../../lib/theme/workmapTheme";

export function PrivacyNoticeCard() {
  return (
    <section style={styles.card}>
      <p style={styles.label}>Privacy posture</p>
      <h2 style={styles.title}>Transparent, role-based visibility</h2>
      <div style={styles.grid}>
        <div>
          <p style={styles.subhead}>Collected</p>
          <p style={styles.text}>App name, website domain, active/idle state, device heartbeat, work session time.</p>
        </div>
        <div>
          <p style={styles.subhead}>Not collected</p>
          <p style={styles.text}>Keystrokes, screenshots, camera, microphone, message content, email body, passwords.</p>
        </div>
      </div>
    </section>
  );
}

const styles = {
  card: {
    ...wmStyles.infoNotice,
    padding: "16px",
  },
  label: {
    ...wmStyles.eyebrow,
    color: wm.colors.infoText,
  },
  title: {
    margin: "0 0 12px",
    color: wm.colors.text,
    fontSize: "18px",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  subhead: {
    margin: "0 0 6px",
    color: wm.colors.text,
    fontWeight: 700,
  },
  text: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.45,
  },
};
