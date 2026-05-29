export default function AvatarDebugPage() {
  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Avatar Debug Frames</h1>
      <p style={styles.text}>Use these sheets to review the current Body 2 frame choices and crop behavior.</p>
      <section style={styles.stack}>
        <DebugImage title="Active state frames" src="/assets/avatars/debug/body2-active-state-frames.png" />
        <DebugImage title="Visible candidates" src="/assets/avatars/debug/body2-visible-candidates.png" />
        <DebugImage title="Crop check" src="/assets/avatars/debug/body2-crop-check.png" />
      </section>
    </main>
  );
}

function DebugImage({ title, src }: { title: string; src: string }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.heading}>{title}</h2>
      <p style={styles.path}>{src}</p>
      <img src={src} alt={title} style={styles.image} />
    </section>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px",
    background: "#f3f7fb",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "32px",
  },
  text: {
    margin: "0 0 20px",
    color: "#475569",
  },
  stack: {
    display: "grid",
    gap: "18px",
  },
  card: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
    overflow: "auto",
  },
  heading: {
    margin: "0 0 4px",
    fontSize: "20px",
  },
  path: {
    margin: "0 0 12px",
    color: "#64748b",
    fontSize: "13px",
  },
  image: {
    display: "block",
    maxWidth: "none",
  },
};
