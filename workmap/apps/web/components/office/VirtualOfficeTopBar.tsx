"use client";

import type { UserPresenceStatus } from "@workmap/shared-types";
import { labelStatus, statusColors } from "./presence";

type VirtualOfficeTopBarProps = {
  status: UserPresenceStatus;
};

export function VirtualOfficeTopBar({ status }: VirtualOfficeTopBarProps) {
  return (
    <header style={styles.bar}>
      <div style={styles.brandGroup}>
        <div style={styles.logo} aria-hidden="true">
          WM
        </div>
        <div style={styles.titleWrap}>
          <span style={styles.title}>WorkMap Office</span>
          <span style={styles.chevron}>v</span>
        </div>
      </div>

      <div style={styles.rightGroup}>
        <span style={styles.statusPill}>
          <span style={{ ...styles.statusDot, background: statusColors[status] }} />
          {labelStatus(status)}
          <span style={styles.chevron}>v</span>
        </span>
        <span style={styles.divider} />
        <button aria-label="Team" style={styles.iconButton} type="button">
          Team
        </button>
        <button aria-label="Search" style={styles.iconButton} type="button">
          Search
        </button>
        <button aria-label="Settings" style={styles.iconButton} type="button">
          Settings
        </button>
        <button aria-label="Help" style={styles.iconButton} type="button">
          Help
        </button>
        <button aria-label="Current user" style={styles.avatarButton} type="button">
          You
          <span style={styles.avatarDot} />
        </button>
      </div>
    </header>
  );
}

const styles = {
  bar: {
    position: "absolute" as const,
    top: "18px",
    left: "24px",
    right: "24px",
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    minHeight: "58px",
    padding: "10px 14px",
    border: "1px solid rgba(203, 213, 225, 0.7)",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.78)",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.14)",
    backdropFilter: "blur(18px)",
  },
  brandGroup: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minWidth: 0,
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    background: "#25346f",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: 0,
  },
  titleWrap: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: 0,
  },
  title: {
    color: "#111827",
    fontSize: "18px",
    fontWeight: 800,
    whiteSpace: "nowrap" as const,
  },
  chevron: {
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
  },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "9px",
    minHeight: "38px",
    padding: "0 14px",
    border: "1px solid rgba(203, 213, 225, 0.85)",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.9)",
    color: "#1f2937",
    fontSize: "14px",
    fontWeight: 700,
    textTransform: "capitalize" as const,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
  },
  statusDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
  },
  divider: {
    width: "1px",
    height: "30px",
    background: "rgba(148, 163, 184, 0.5)",
    margin: "0 4px",
  },
  iconButton: {
    display: "grid",
    placeItems: "center",
    minWidth: "38px",
    height: "38px",
    border: 0,
    borderRadius: "12px",
    background: "transparent",
    color: "#1f2937",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 800,
  },
  avatarButton: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    width: "40px",
    height: "40px",
    border: "1px solid rgba(203, 213, 225, 0.9)",
    borderRadius: "999px",
    background: "#f8fafc",
    color: "#1f2937",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 800,
  },
  avatarDot: {
    position: "absolute" as const,
    right: "-1px",
    bottom: "1px",
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    border: "2px solid #ffffff",
    background: "#22c55e",
  },
};
