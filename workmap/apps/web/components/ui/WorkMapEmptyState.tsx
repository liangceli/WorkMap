import type { ReactNode } from "react";
import { wm } from "../../lib/theme/workmapTheme";

export function WorkMapEmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={styles.emptyState}>
      <h2 style={styles.title}>{title}</h2>
      <p style={styles.text}>{children}</p>
    </div>
  );
}

const styles = {
  emptyState: {
    padding: "34px",
    textAlign: "center" as const,
  },
  title: {
    margin: "0 0 8px",
    color: wm.colors.text,
    fontSize: "18px",
  },
  text: {
    margin: 0,
    color: wm.colors.textSecondary,
  },
};
