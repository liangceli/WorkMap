"use client";

import { wm } from "../../lib/theme/workmapTheme";

type MovementHintProps = {
  hasInteractionTarget: boolean;
};

export function MovementHint({ hasInteractionTarget }: MovementHintProps) {
  return (
    <div style={{ ...styles.hint, bottom: hasInteractionTarget ? "198px" : "24px" }}>
      <span style={styles.icon}>Move</span>
      <span>
        Use <strong>WASD</strong> or arrow keys to move
      </span>
    </div>
  );
}

const styles = {
  hint: {
    position: "absolute" as const,
    left: "50%",
    zIndex: 18,
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "calc(100vw - 48px)",
    padding: "10px 14px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: "rgba(255, 253, 248, 0.9)",
    color: wm.colors.textSecondary,
    boxShadow: wm.shadow.card,
    backdropFilter: "blur(14px)",
    fontSize: "13px",
    fontWeight: 600,
    transform: "translateX(-50%)",
    transition: "bottom 160ms ease",
    whiteSpace: "nowrap" as const,
  },
  icon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "42px",
    height: "24px",
    borderRadius: "999px",
    background: "rgba(31, 122, 120, 0.1)",
    color: wm.colors.secondary,
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
  },
};
