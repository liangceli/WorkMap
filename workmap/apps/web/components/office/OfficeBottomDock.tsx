"use client";

import type { UserPresenceStatus } from "@workmap/shared-types";
import { OfficeIcon } from "./OfficeIcons";
import { labelStatus, statusColors } from "./presence";

type OfficeBottomDockProps = {
  status: UserPresenceStatus;
  hidden?: boolean;
  onSearch: () => void;
  onOpenChat: () => void;
  onOpenCalendar: () => void;
  onWave: () => void;
  onEmoji: () => void;
  onToast: (message: string) => void;
};

export function OfficeBottomDock({
  status,
  hidden,
  onSearch,
  onOpenChat,
  onOpenCalendar,
  onWave,
  onEmoji,
  onToast,
}: OfficeBottomDockProps) {
  if (hidden) {
    return null;
  }

  return (
    <nav style={styles.dock} aria-label="Office actions">
      <style>{`
        .office-dock-action:hover .office-dock-tooltip,
        .office-dock-action:focus-visible .office-dock-tooltip {
          opacity: 1 !important;
          transform: translateX(-50%) translateY(0) !important;
        }
        .office-dock-action:hover,
        .office-dock-action:focus-visible {
          background: rgba(255, 255, 255, 0.16) !important;
        }
      `}</style>
      <div style={styles.identity}>
        <div style={styles.avatar}>
          You
          <span style={{ ...styles.avatarDot, background: statusColors[status] }} />
        </div>
        <div style={styles.statusText}>
          <span style={styles.statusLabel}>Status</span>
          <strong>{labelStatus(status)}</strong>
        </div>
      </div>

      <span style={styles.divider} />

      <button type="button" className="office-dock-action" style={styles.action} onClick={() => onToast("Status changes are local-only in this MVP.")} aria-label="Status">
        <OfficeIcon name="status" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>Status</span>
      </button>
      <button type="button" className="office-dock-action" style={styles.action} onClick={onWave} aria-label="Wave">
        <OfficeIcon name="wave" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>Wave</span>
      </button>
      <button type="button" className="office-dock-action" style={styles.action} onClick={onEmoji} aria-label="Emote">
        <OfficeIcon name="smile" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>Emote</span>
      </button>
      <button type="button" className="office-dock-action" style={styles.action} onClick={onSearch} aria-label="Search">
        <OfficeIcon name="search" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>Search</span>
      </button>
      <button type="button" className="office-dock-action" style={styles.action} onClick={onOpenChat} aria-label="Teams">
        <OfficeIcon name="people" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>Teams</span>
      </button>
      <button type="button" className="office-dock-action" style={styles.action} onClick={() => { window.location.href = "mailto:"; }} aria-label="Outlook">
        <OfficeIcon name="mail" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>Outlook</span>
      </button>
      <button type="button" className="office-dock-action" style={styles.action} onClick={() => onToast("3CX launcher placeholder.")} aria-label="3CX">
        <OfficeIcon name="phone" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>3CX</span>
      </button>
      <button type="button" className="office-dock-action" style={styles.action} onClick={onOpenCalendar} aria-label="Schedule">
        <OfficeIcon name="calendar" size={28} />
        <span className="office-dock-tooltip" style={styles.tooltip}>Schedule</span>
      </button>
    </nav>
  );
}

const styles = {
  dock: {
    position: "absolute" as const,
    left: "50%",
    bottom: "50px",
    zIndex: 24,
    display: "flex",
    alignItems: "center",
    gap: "18px",
    maxWidth: "min(840px, calc(100vw - 360px))",
    padding: "12px 18px",
    border: "1px solid rgba(255, 255, 255, 0.18)",
    borderRadius: "999px",
    background: "rgba(22, 35, 90, 0.96)",
    color: "#ffffff",
    boxShadow: "0 26px 70px rgba(15, 23, 42, 0.28)",
    backdropFilter: "blur(20px)",
    transform: "translateX(-50%)",
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    paddingRight: "6px",
  },
  avatar: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    width: "58px",
    height: "58px",
    borderRadius: "999px",
    background: "#0f1a44",
    color: "#ffffff",
    fontSize: "11px",
    fontWeight: 900,
  },
  avatarDot: {
    position: "absolute" as const,
    right: "-1px",
    bottom: "2px",
    width: "14px",
    height: "14px",
    borderRadius: "999px",
    border: "3px solid #16235a",
  },
  statusText: {
    display: "grid",
    gap: "1px",
    minWidth: "96px",
    fontSize: "12px",
    lineHeight: 1.15,
  },
  statusLabel: {
    color: "rgba(255, 255, 255, 0.62)",
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  divider: {
    width: "1px",
    height: "34px",
    background: "rgba(255, 255, 255, 0.2)",
    margin: "0 4px",
  },
  action: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    minWidth: "54px",
    minHeight: "54px",
    border: "1px solid transparent",
    borderRadius: "999px",
    background: "transparent",
    color: "rgba(255, 255, 255, 0.82)",
    padding: "0 4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap" as const,
  },
  tooltip: {
    position: "absolute" as const,
    left: "50%",
    bottom: "calc(100% + 10px)",
    zIndex: 2,
    padding: "5px 9px",
    borderRadius: "7px",
    background: "rgba(15, 23, 42, 0.96)",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
    lineHeight: 1,
    opacity: 0,
    pointerEvents: "none" as const,
    transform: "translateX(-50%) translateY(4px)",
    transition: "opacity 120ms ease, transform 120ms ease",
  },
};
