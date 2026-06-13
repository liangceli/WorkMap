"use client";

import type { UserPresenceStatus } from "@workmap/shared-types";
import { wm } from "../../lib/theme/workmapTheme";
import { OfficeIcon } from "./OfficeIcons";
import { labelStatus, statusColors } from "./presence";
import type { VirtualOfficeRealtimeState } from "./useVirtualOfficeRealtime";

type VirtualOfficeTopBarProps = {
  status: UserPresenceStatus;
  currentArea?: string;
  presenceSource: "mock" | "api" | "partial-api";
  realtimeState: VirtualOfficeRealtimeState;
  remoteCount: number;
  onSearch?: () => void;
};

export function VirtualOfficeTopBar({
  status,
  currentArea = "Office",
  presenceSource,
  realtimeState,
  remoteCount,
  onSearch,
}: VirtualOfficeTopBarProps) {
  const connection = connectionCopy(realtimeState, presenceSource, remoteCount);

  return (
    <>
      <header className="wm-office-top-brand" style={styles.workspacePill}>
        <div style={styles.logo} aria-hidden="true">
          WM
        </div>
        <div style={styles.titleWrap}>
          <span style={styles.title}>Virtual Office</span>
          <span style={styles.caption}>Live team presence</span>
        </div>
        <span style={styles.chevron}><OfficeIcon name="chevronDown" size={18} /></span>
      </header>

      <button type="button" className="wm-office-area-pill" onClick={onSearch} style={styles.areaPill} aria-label="Find people, rooms, or actions">
        <span style={styles.areaIcon}><OfficeIcon name="room" size={22} /></span>
        <span>{currentArea}</span>
        <span style={styles.chevron}><OfficeIcon name="chevronDown" size={18} /></span>
      </button>

      <div className="wm-office-sync-pill" style={styles.syncPill} aria-label="Office sync status">
        <span style={{ ...styles.syncDot, background: connection.color }} />
        <span style={styles.syncText}>
          <strong>{connection.label}</strong>
          <span>{connection.detail}</span>
        </span>
      </div>

      <div className="wm-office-status-pill" style={styles.statusPill}>
        <button type="button" style={styles.searchButton} onClick={onSearch} aria-label="Find people, rooms, or actions">
          <OfficeIcon name="search" size={20} />
          <span>Search</span>
        </button>
        <span style={styles.statusDivider} />
        <span style={styles.statusText}>
          <span style={{ ...styles.statusDot, background: statusColors[status] }} />
          {labelStatus(status)}
        </span>
        <button aria-label="Current user" style={styles.avatarButton} type="button">
          You
          <span style={styles.avatarDot} />
        </button>
      </div>
    </>
  );
}

function connectionCopy(
  realtimeState: VirtualOfficeRealtimeState,
  presenceSource: VirtualOfficeTopBarProps["presenceSource"],
  remoteCount: number,
) {
  if (presenceSource === "mock") {
    return {
      label: "Demo presence",
      detail: "API unavailable; map stays usable",
      color: wm.status.idle,
    };
  }

  if (realtimeState === "connected") {
    return {
      label: "Realtime connected",
      detail: `${remoteCount} teammate${remoteCount === 1 ? "" : "s"} visible`,
      color: wm.status.available,
    };
  }

  if (realtimeState === "connecting" || realtimeState === "reconnecting") {
    return {
      label: "Reconnecting",
      detail: "Polling keeps presence updated",
      color: wm.status.busy,
    };
  }

  return {
    label: presenceSource === "partial-api" ? "Partial API" : "Polling fallback",
    detail: "Presence refreshes automatically",
    color: wm.status.idle,
  };
}

const styles = {
  workspacePill: {
    position: "absolute" as const,
    top: "22px",
    left: "22px",
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "76px",
    padding: "12px 18px 12px 12px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius["2xl"],
    background: "rgba(255, 253, 248, 0.9)",
    boxShadow: wm.shadow.elevated,
    backdropFilter: "blur(20px)",
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: "52px",
    height: "52px",
    borderRadius: wm.radius.xl,
    background: wm.colors.primary,
    color: wm.colors.surface,
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: 0,
    boxShadow: "0 12px 28px rgba(16, 35, 63, 0.18)",
  },
  titleWrap: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
  },
  title: {
    color: wm.colors.text,
    fontSize: "16px",
    fontWeight: 800,
    whiteSpace: "nowrap" as const,
  },
  caption: {
    color: wm.colors.textMuted,
    fontSize: "11px",
    fontWeight: 700,
  },
  chevron: {
    display: "grid",
    placeItems: "center",
    color: wm.colors.textSecondary,
  },
  areaPill: {
    position: "absolute" as const,
    top: "29px",
    left: "306px",
    zIndex: 20,
    display: "inline-flex",
    alignItems: "center",
    gap: "11px",
    minHeight: "58px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius["2xl"],
    background: "rgba(255, 253, 248, 0.9)",
    color: wm.colors.text,
    padding: "0 22px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 700,
    boxShadow: wm.shadow.card,
    backdropFilter: "blur(18px)",
  },
  syncPill: {
    position: "absolute" as const,
    top: "94px",
    left: "306px",
    zIndex: 19,
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "380px",
    minHeight: "42px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: "rgba(255, 253, 248, 0.86)",
    color: wm.colors.text,
    padding: "7px 13px",
    boxShadow: wm.shadow.card,
    backdropFilter: "blur(16px)",
  },
  syncDot: {
    flex: "0 0 auto",
    width: "10px",
    height: "10px",
    borderRadius: "999px",
  },
  syncText: {
    display: "grid",
    gap: "1px",
    minWidth: 0,
    fontSize: "11px",
    lineHeight: 1.2,
    color: wm.colors.textMuted,
    fontWeight: 750,
  },
  areaIcon: {
    color: wm.colors.secondary,
    fontSize: "13px",
    fontWeight: 900,
  },
  statusPill: {
    position: "absolute" as const,
    top: "22px",
    right: "22px",
    zIndex: 20,
    display: "inline-flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "68px",
    padding: "8px 10px 8px 12px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius["2xl"],
    background: "rgba(255, 253, 248, 0.9)",
    color: wm.colors.text,
    boxShadow: wm.shadow.elevated,
    backdropFilter: "blur(18px)",
  },
  searchButton: {
    border: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "44px",
    borderRadius: "14px",
    background: "rgba(244, 248, 244, 0.72)",
    color: wm.colors.textSecondary,
    cursor: "pointer",
    padding: "0 14px",
    fontSize: "14px",
    fontWeight: 700,
  },
  statusDivider: {
    width: "1px",
    height: "30px",
    background: "rgba(115, 128, 149, 0.28)",
  },
  statusText: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: 900,
    textTransform: "capitalize" as const,
  },
  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
  },
  avatarButton: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
    border: `1px solid ${wm.colors.borderStrong}`,
    borderRadius: "999px",
    background: wm.colors.surfaceLow,
    color: wm.colors.text,
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 700,
  },
  avatarDot: {
    position: "absolute" as const,
    right: "-1px",
    bottom: "1px",
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    border: `2px solid ${wm.colors.surface}`,
    background: wm.status.available,
  },
};
