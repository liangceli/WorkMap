"use client";

import type { UserPresenceStatus } from "@workmap/shared-types";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getVirtualOfficeNavigationItemsForRole } from "../../lib/navigation/workspaceNavigation";
import { wm } from "../../lib/theme/workmapTheme";
import type { WorkMapRole } from "../../lib/workflow/workflowState";
import { OfficeIcon } from "./OfficeIcons";
import { labelStatus, statusColors } from "./presence";
import type { VirtualOfficeRealtimeState } from "./useVirtualOfficeRealtime";
import { CandidGridMark } from "../brand/CandidGridMark";

type VirtualOfficeTopBarProps = {
  status: UserPresenceStatus;
  currentArea?: string;
  presenceSource: "mock" | "api" | "partial-api";
  realtimeState: VirtualOfficeRealtimeState;
  remoteCount: number;
  currentUserRole: WorkMapRole;
  onSearch?: () => void;
};

export function VirtualOfficeTopBar({
  status,
  currentArea = "Office",
  presenceSource,
  realtimeState,
  remoteCount,
  currentUserRole,
  onSearch,
}: VirtualOfficeTopBarProps) {
  const connection = connectionCopy(realtimeState, presenceSource, remoteCount);
  const workspaceRoutes = getVirtualOfficeNavigationItemsForRole(currentUserRole);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!navigationOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) {
        setNavigationOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavigationOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [navigationOpen]);

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .wm-office-top-brand {
            top: max(10px, env(safe-area-inset-top)) !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            min-height: 58px !important;
            padding: 8px 12px 8px 8px !important;
            border-radius: 20px !important;
            z-index: 62 !important;
          }

          .wm-office-brand-logo {
            width: 42px !important;
            height: 42px !important;
            border-radius: 15px !important;
          }

          .wm-office-brand-title {
            font-size: 15px !important;
          }

          .wm-office-brand-caption,
          .wm-office-sync-pill,
          .wm-office-left-rail,
          .wm-office-minimap {
            display: none !important;
          }

          .wm-office-navigation-menu {
            top: calc(max(10px, env(safe-area-inset-top)) + 66px) !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            max-height: min(56vh, 360px) !important;
            overflow-y: auto !important;
            z-index: 72 !important;
          }

          .wm-office-area-pill {
            top: calc(max(10px, env(safe-area-inset-top)) + 66px) !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            min-height: 44px !important;
            justify-content: center !important;
            padding: 0 14px !important;
            border-radius: 18px !important;
            font-size: 15px !important;
            z-index: 45 !important;
          }

          .wm-office-status-pill {
            top: calc(max(10px, env(safe-area-inset-top)) + 118px) !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            min-height: 48px !important;
            padding: 6px 8px !important;
            gap: 8px !important;
            border-radius: 18px !important;
            justify-content: space-between !important;
            z-index: 44 !important;
          }

          .wm-office-search-label,
          .wm-office-status-divider {
            display: none !important;
          }

          .wm-office-search-button {
            min-width: 44px !important;
            min-height: 40px !important;
            padding: 0 12px !important;
            justify-content: center !important;
          }

          .wm-office-status-text {
            flex: 1 1 auto !important;
            justify-content: center !important;
            font-size: 13px !important;
          }

          .wm-office-avatar-button {
            width: 42px !important;
            height: 42px !important;
            font-size: 10px !important;
          }

          .wm-office-map-controls {
            right: 12px !important;
            bottom: calc(88px + env(safe-area-inset-bottom)) !important;
            width: 48px !important;
            gap: 6px !important;
            padding: 6px 5px 8px !important;
            border-radius: 18px !important;
            z-index: 36 !important;
          }

          .wm-office-map-controls button {
            width: 36px !important;
            height: 36px !important;
            border-radius: 12px !important;
          }

          .wm-office-map-controls span {
            font-size: 11px !important;
          }

          .wm-office-side-panel {
            top: auto !important;
            left: 12px !important;
            right: 12px !important;
            bottom: calc(76px + env(safe-area-inset-bottom)) !important;
            width: auto !important;
            max-height: min(58vh, 420px) !important;
            border-radius: 22px !important;
            z-index: 58 !important;
          }

          .wm-office-room-card,
          .wm-office-interaction-drawer {
            top: auto !important;
            left: 12px !important;
            right: 12px !important;
            bottom: calc(76px + env(safe-area-inset-bottom)) !important;
            width: auto !important;
            max-height: min(56vh, 420px) !important;
            overflow: auto !important;
            border-radius: 22px !important;
            z-index: 59 !important;
          }

          .wm-office-interaction-drawer {
            grid-template-columns: 1fr !important;
            gap: 14px !important;
            min-height: 0 !important;
            padding: 18px 18px 18px !important;
          }

          .wm-office-command-backdrop {
            padding: calc(max(10px, env(safe-area-inset-top)) + 12px) 12px 12px !important;
            place-items: start stretch !important;
          }

          .wm-office-command-palette {
            width: auto !important;
            max-height: calc(100vh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)) !important;
            border-radius: 22px !important;
          }

          .wm-command-result-row {
            grid-template-columns: 38px minmax(0, 1fr) !important;
          }

          .wm-command-result-row > span:nth-last-child(-n + 2) {
            justify-self: start !important;
          }

          .wm-office-toast {
            top: calc(max(10px, env(safe-area-inset-top)) + 174px) !important;
            left: 12px !important;
            right: 12px !important;
            transform: none !important;
            width: auto !important;
            text-align: center !important;
          }
        }

        @media (max-width: 420px) {
          .wm-office-top-brand,
          .wm-office-area-pill,
          .wm-office-status-pill {
            left: 10px !important;
            right: 10px !important;
          }

          .wm-office-navigation-menu {
            left: 10px !important;
            right: 10px !important;
          }

          .wm-office-status-pill {
            top: calc(max(10px, env(safe-area-inset-top)) + 114px) !important;
          }
        }
      `}</style>
      <div ref={navigationRef} style={styles.navigationRoot}>
        <button
          type="button"
          className="wm-office-top-brand"
          style={styles.workspacePill}
          aria-haspopup="menu"
          aria-expanded={navigationOpen}
          aria-controls="virtual-office-navigation"
          onClick={() => setNavigationOpen((open) => !open)}
        >
          <div className="wm-office-brand-logo" style={styles.logo} aria-hidden="true"><CandidGridMark size={40} /></div>
          <div className="wm-office-brand-title-wrap" style={styles.titleWrap}>
            <span className="wm-office-brand-title" style={styles.title}>Virtual Office</span>
            <span className="wm-office-brand-caption" style={styles.caption}>Live team presence</span>
          </div>
          <span style={{ ...styles.chevron, transform: navigationOpen ? "rotate(180deg)" : "none" }}>
            <OfficeIcon name="chevronDown" size={18} />
          </span>
        </button>

        {navigationOpen ? (
          <nav id="virtual-office-navigation" className="wm-office-navigation-menu" role="menu" aria-label="Workspace pages" style={styles.navigationMenu}>
            {workspaceRoutes.map((route) => (
              <Link className="wm-office-navigation-link" key={route.href} href={route.href} role="menuitem" style={styles.navigationLink} onClick={() => setNavigationOpen(false)}>
                <span style={styles.navigationLabel}>{route.label}</span>
                <span style={styles.navigationDescription}>{route.description}</span>
              </Link>
            ))}
          </nav>
        ) : null}
      </div>

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
        <button type="button" className="wm-office-search-button" style={styles.searchButton} onClick={onSearch} aria-label="Find people, rooms, or actions">
          <OfficeIcon name="search" size={20} />
          <span className="wm-office-search-label">Search</span>
        </button>
        <span className="wm-office-status-divider" style={styles.statusDivider} />
        <span className="wm-office-status-text" style={styles.statusText}>
          <span style={{ ...styles.statusDot, background: statusColors[status] }} />
          {labelStatus(status)}
        </span>
        <button className="wm-office-avatar-button" aria-label="Current user" style={styles.avatarButton} type="button">
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
      label: "Presence offline",
      detail: "Sign in to load workspace teammates",
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
  navigationRoot: {
    display: "contents",
  },
  workspacePill: {
    position: "absolute" as const,
    top: "22px",
    left: "22px",
    zIndex: 50,
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
    color: wm.colors.text,
    cursor: "pointer",
    fontFamily: "inherit",
    textAlign: "left" as const,
  },
  logo: {
    display: "grid",
    placeItems: "center",
    width: "52px",
    height: "52px",
    flex: "0 0 52px",
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
    transition: "transform 160ms ease",
  },
  navigationMenu: {
    position: "absolute" as const,
    top: "106px",
    left: "22px",
    zIndex: 50,
    display: "grid",
    width: "280px",
    overflow: "hidden",
    padding: "8px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.xl,
    background: "rgba(255, 253, 248, 0.98)",
    boxShadow: wm.shadow.elevated,
    backdropFilter: "blur(20px)",
  },
  navigationLink: {
    display: "grid",
    gap: "2px",
    padding: "11px 12px",
    borderRadius: wm.radius.md,
    color: wm.colors.text,
    textDecoration: "none",
  },
  navigationLabel: {
    fontSize: "14px",
    fontWeight: 800,
  },
  navigationDescription: {
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 600,
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
