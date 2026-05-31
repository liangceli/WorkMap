import { wm, wmStyles } from "../../lib/theme/workmapTheme";

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
    ...wmStyles.page,
    padding: "32px",
  },
  title: {
    ...wmStyles.pageTitle,
  },
  text: {
    ...wmStyles.pageSubtitle,
    margin: "0 0 24px",
  },
  stack: {
    display: "grid",
    gap: "18px",
  },
  card: {
    ...wmStyles.card,
    padding: "16px",
    overflow: "auto",
  },
  heading: {
    margin: "0 0 4px",
    color: wm.colors.text,
    fontSize: "20px",
    fontWeight: 700,
  },
  path: {
    margin: "0 0 12px",
    color: wm.colors.textMuted,
    fontSize: "13px",
  },
  image: {
    display: "block",
    maxWidth: "none",
  },
};
