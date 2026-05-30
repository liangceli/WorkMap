"use client";

export type OfficePanelKey = "people" | "search" | "chat" | "calendar" | "notices" | "settings";

type OfficeLeftRailProps = {
  activePanel: OfficePanelKey | null;
  onSelectPanel: (panel: OfficePanelKey) => void;
};

const railItems: Array<{ key: OfficePanelKey; label: string; short: string }> = [
  { key: "people", label: "People", short: "P" },
  { key: "search", label: "Search", short: "K" },
  { key: "chat", label: "Chat", short: "C" },
  { key: "calendar", label: "Calendar", short: "S" },
  { key: "notices", label: "Notices", short: "N" },
  { key: "settings", label: "Settings", short: "G" },
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
          }}
        >
          <span style={styles.short}>{item.short}</span>
        </button>
      ))}
    </nav>
  );
}

const styles = {
  rail: {
    position: "absolute" as const,
    top: "96px",
    left: "18px",
    zIndex: 35,
    display: "grid",
    gap: "8px",
    padding: "8px",
    border: "1px solid rgba(203, 213, 225, 0.72)",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.82)",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.14)",
    backdropFilter: "blur(16px)",
  },
  button: {
    display: "grid",
    placeItems: "center",
    width: "42px",
    height: "42px",
    border: "1px solid transparent",
    borderRadius: "13px",
    background: "transparent",
    color: "#334155",
    cursor: "pointer",
  },
  buttonActive: {
    borderColor: "#bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  short: {
    fontSize: "13px",
    fontWeight: 900,
  },
};
