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
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    padding: "16px",
  },
  label: {
    margin: "0 0 6px",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 12px",
    fontSize: "18px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px",
  },
  subhead: {
    margin: "0 0 6px",
    fontWeight: 800,
  },
  text: {
    margin: 0,
    color: "#334155",
    fontSize: "13px",
    lineHeight: 1.45,
  },
};
