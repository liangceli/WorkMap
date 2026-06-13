"use client";

import type { UserPresenceStatus } from "@workmap/shared-types";
import { wm } from "../../lib/theme/workmapTheme";
import { OfficeIcon } from "./OfficeIcons";
import { labelStatus, statusColors } from "./presence";

type VirtualOfficeTopBarProps = {
  status: UserPresenceStatus;
  currentArea?: string;
  onSearch?: () => void;
};

export function VirtualOfficeTopBar({ status, currentArea = "Office", onSearch }: VirtualOfficeTopBarProps) {
  return (
    <>
      <header style={styles.workspacePill}>
        <div style={styles.logo} aria-hidden="true">
          WM
        </div>
        <div style={styles.titleWrap}>
          <span style={styles.title}>Virtual Office</span>
          <span style={styles.caption}>Live team presence</span>
        </div>
        <span style={styles.chevron}><OfficeIcon name="chevronDown" size={18} /></span>
      </header>

      <button type="button" onClick={onSearch} style={styles.areaPill} aria-label="Find people, rooms, or actions">
        <span style={styles.areaIcon}><OfficeIcon name="room" size={22} /></span>
        <span>{currentArea}</span>
        <span style={styles.chevron}><OfficeIcon name="chevronDown" size={18} /></span>
      </button>

      <div style={styles.statusPill}>
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
    border: "1px solid rgba(216, 224, 236, 0.82)",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.86)",
    boxShadow: "0 20px 48px rgba(15, 23, 42, 0.14)",
    backdropFilter: "blur(24px)",
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: "52px",
    height: "52px",
    borderRadius: "14px",
    background: wm.colors.primaryContainer,
    color: wm.colors.surface,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: 0,
  },
  titleWrap: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
  },
  title: {
    color: wm.colors.text,
    fontSize: "16px",
    fontWeight: 700,
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
    border: "1px solid rgba(216, 224, 236, 0.82)",
    borderRadius: "20px",
    background: "rgba(255, 255, 255, 0.86)",
    color: wm.colors.text,
    padding: "0 22px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 700,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.14)",
    backdropFilter: "blur(22px)",
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
    border: "1px solid rgba(216, 224, 236, 0.82)",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.88)",
    color: wm.colors.text,
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.16)",
    backdropFilter: "blur(22px)",
  },
  searchButton: {
    border: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "44px",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.64)",
    color: wm.colors.textSecondary,
    cursor: "pointer",
    padding: "0 14px",
    fontSize: "14px",
    fontWeight: 700,
  },
  statusDivider: {
    width: "1px",
    height: "30px",
    background: "rgba(148, 163, 184, 0.5)",
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
    border: "1px solid rgba(203, 213, 225, 0.9)",
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
    background: "#22c55e",
  },
};
