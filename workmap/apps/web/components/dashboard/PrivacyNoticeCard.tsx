import { wm, wmStyles } from "../../lib/theme/workmapTheme";

export function PrivacyNoticeCard() {
  return (
    <section style={styles.card}>
      <p style={styles.label}>Employee monitoring boundary</p>
      <h2 style={styles.title}>What CandidGrid records—and what it does not</h2>
      <div style={styles.grid}>
        <div>
          <p style={styles.subhead}>Collected</p>
          <p style={styles.text}>Foreground App and focused HTTP/HTTPS hostname with Focus active/focused idle time; policy-enabled App or Domain open/runtime; device health; virtual-office presence; notice confirmation; and in-app content a user intentionally sends or interacts with.</p>
        </div>
        <div>
          <p style={styles.subhead}>Not collected</p>
          <p style={styles.text}>Screenshots or recordings; window/page titles or files; URL paths, queries or fragments; page/form/password content; key values or typed text; pointer details; clipboard; camera/microphone; or external private message, Teams or email body content. Read this with your organisation&apos;s own monitoring notice.</p>
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
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
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
