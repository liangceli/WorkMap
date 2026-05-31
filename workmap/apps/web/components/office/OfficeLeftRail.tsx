"use client";

import { wm } from "../../lib/theme/workmapTheme";
import { OfficeIcon } from "./OfficeIcons";

export type OfficePanelKey = "search" | "rooms" | "people" | "chat" | "calendar" | "notices" | "settings";

type OfficeLeftRailProps = {
  activePanel: OfficePanelKey | null;
  onSelectPanel: (panel: OfficePanelKey) => void;
};

const railItems: Array<{ key: OfficePanelKey; label: string; icon: Parameters<typeof OfficeIcon>[0]["name"]; hasBadge?: boolean; bottom?: boolean }> = [
  { key: "search", label: "Search", icon: "search" },
  { key: "rooms", label: "Rooms and map", icon: "map" },
  { key: "people", label: "People", icon: "people" },
  { key: "chat", label: "Chat", icon: "chat", hasBadge: true },
  { key: "calendar", label: "Calendar", icon: "calendar" },
  { key: "notices", label: "Notices", icon: "chat", hasBadge: true },
  { key: "settings", label: "Settings", icon: "settings", bottom: true },
];

export function OfficeLeftRail({ activePanel, onSelectPanel }: OfficeLeftRailProps) {
  return (
    <nav style={styles.rail} aria-label="Office tools">
      {railItems.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-label={item.label}
          title={item.label}
          onClick={() => onSelectPanel(item.key)}
          style={{
            ...styles.button,
            ...(activePanel === item.key ? styles.buttonActive : {}),
            ...(item.bottom ? styles.buttonBottom : {}),
          }}
        >
          <OfficeIcon name={item.icon} size={30} />
          {item.hasBadge ? <span style={styles.badge} /> : null}
        </button>
      ))}
    </nav>
  );
}

const styles = {
  rail: {
    position: "absolute" as const,
    top: "124px",
    left: "22px",
    bottom: "300px",
    zIndex: 35,
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
    width: "74px",
    padding: "16px 10px",
    border: "1px solid rgba(216, 224, 236, 0.8)",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.78)",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
    backdropFilter: "blur(22px)",
  },
  button: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    width: "54px",
    height: "54px",
    border: 0,
    borderRadius: "16px",
    background: "transparent",
    color: wm.colors.textSecondary,
    cursor: "pointer",
    outline: "none",
  },
  buttonActive: {
    background: wm.colors.primaryContainer,
    color: wm.colors.surface,
    boxShadow: "0 14px 30px rgba(22, 35, 90, 0.18)",
  },
  buttonBottom: {
    marginTop: "auto",
  },
  badge: {
    position: "absolute" as const,
    right: "8px",
    top: "8px",
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    border: `2.5px solid ${wm.colors.surface}`,
    background: "#ef4444",
  },
};
