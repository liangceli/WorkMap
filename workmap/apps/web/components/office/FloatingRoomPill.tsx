"use client";

import type { OfficeRoomZone } from "@workmap/shared-types";
import { wm } from "../../lib/theme/workmapTheme";

type FloatingRoomPillProps = {
  room?: OfficeRoomZone;
  seated: boolean;
  chairNearby: boolean;
  elevated: boolean;
};

export function FloatingRoomPill({ room, seated, chairNearby, elevated }: FloatingRoomPillProps) {
  const context = seated ? "Seated at desk - press E to stand" : chairNearby ? "Desk nearby - press E to sit" : room?.name ?? "Open Area";

  if (!seated && !chairNearby) {
    return null;
  }

  return (
    <div style={{ ...styles.pill, bottom: elevated ? "198px" : "154px" }}>
      <span style={styles.kicker}>Interaction</span>
      <span style={styles.label}>{context}</span>
    </div>
  );
}

const styles = {
  pill: {
    position: "absolute" as const,
    left: "50%",
    zIndex: 18,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "min(520px, calc(100vw - 48px))",
    padding: "10px 14px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: "rgba(255, 253, 248, 0.9)",
    color: wm.colors.text,
    boxShadow: wm.shadow.card,
    backdropFilter: "blur(16px)",
    transition: "bottom 160ms ease",
    transform: "translateX(-50%)",
  },
  kicker: {
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
  },
  label: {
    overflow: "hidden",
    color: wm.colors.primary,
    fontSize: "14px",
    fontWeight: 800,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
};
