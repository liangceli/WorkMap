"use client";

import { useState } from "react";
import type { UserPresenceStatus } from "@workmap/shared-types";
import type { VirtualOfficeReaction } from "@workmap/shared-types";
import { wm } from "../../lib/theme/workmapTheme";
import { OfficeIcon } from "./OfficeIcons";
import { labelStatus, statusColors } from "./presence";
import { reactionOptions } from "./reactions";

type OfficeBottomDockProps = {
  status: UserPresenceStatus;
  hidden?: boolean;
  onSearch: () => void;
  onOpenChat: () => void;
  onOpenCalendar: () => void;
  onWave: () => void;
  onEmoji: (reaction: VirtualOfficeReaction) => void;
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
  const [emojiOpen, setEmojiOpen] = useState(false);

  if (hidden) {
    return null;
  }

  return (
    <nav className="wm-office-bottom-dock" style={styles.dock} aria-label="Office actions">
      <style>{`
        .office-dock-action:hover .office-dock-tooltip,
        .office-dock-action:focus-visible .office-dock-tooltip {
          opacity: 1 !important;
          transform: translateX(-50%) translateY(0) !important;
        }
        .office-dock-action:hover,
        .office-dock-action:focus-visible {
          background: rgba(31, 122, 120, 0.1) !important;
          color: ${wm.colors.primary} !important;
        }
      `}</style>
      <div className="wm-office-dock-identity" style={styles.identity}>
        <div style={styles.avatar}>
          You
          <span style={{ ...styles.avatarDot, background: statusColors[status] }} />
        </div>
        <div style={styles.statusText}>
          <span style={styles.statusLabel}>Status</span>
          <strong>{labelStatus(status)}</strong>
        </div>
      </div>

      <span className="wm-office-dock-divider" style={styles.divider} />

      <div className="wm-office-dock-actions" style={styles.actions}>
        <button type="button" className="office-dock-action" style={styles.action} onClick={() => onToast("Status follows your room, movement, and chair state in this MVP.")} aria-label="Status">
          <OfficeIcon name="status" size={28} />
          <span className="office-dock-tooltip" style={styles.tooltip}>Status</span>
        </button>
        <button type="button" className="office-dock-action" style={styles.action} onClick={onWave} aria-label="Wave">
          <OfficeIcon name="wave" size={28} />
          <span className="office-dock-tooltip" style={styles.tooltip}>Wave</span>
        </button>
        <span style={styles.emojiWrap}>
          {emojiOpen ? (
            <span style={styles.emojiMenu} aria-label="Choose reaction">
              {reactionOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => {
                    onEmoji(option.key);
                    setEmojiOpen(false);
                  }}
                  style={styles.emojiButton}
                >
                  {option.emoji}
                </button>
              ))}
            </span>
          ) : null}
          <button type="button" className="office-dock-action" style={styles.action} onClick={() => setEmojiOpen((current) => !current)} aria-label="Emote" aria-expanded={emojiOpen}>
            <OfficeIcon name="smile" size={28} />
            <span className="office-dock-tooltip" style={styles.tooltip}>Emote</span>
          </button>
        </span>
        <button type="button" className="office-dock-action" style={styles.action} onClick={onSearch} aria-label="Search">
          <OfficeIcon name="search" size={28} />
          <span className="office-dock-tooltip" style={styles.tooltip}>Search</span>
        </button>
        <button type="button" className="office-dock-action" style={styles.action} onClick={onOpenChat} aria-label="Local quick notes">
          <OfficeIcon name="people" size={28} />
          <span className="office-dock-tooltip" style={styles.tooltip}>Notes</span>
        </button>
        <button type="button" className="office-dock-action" style={styles.action} onClick={() => onToast("Choose a teammate from People or the contact drawer to open Outlook.")} aria-label="Outlook">
          <OfficeIcon name="mail" size={28} />
          <span className="office-dock-tooltip" style={styles.tooltip}>Outlook</span>
        </button>
        <button type="button" className="office-dock-action" style={{ ...styles.action, ...styles.actionDisabled }} disabled onClick={() => onToast("3CX calling is coming later.")} aria-label="3CX coming later">
          <OfficeIcon name="phone" size={28} />
          <span className="office-dock-tooltip" style={styles.tooltip}>3CX later</span>
        </button>
        <button type="button" className="office-dock-action" style={styles.action} onClick={onOpenCalendar} aria-label="Schedule">
          <OfficeIcon name="calendar" size={28} />
          <span className="office-dock-tooltip" style={styles.tooltip}>Schedule</span>
        </button>
      </div>
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
    gap: "12px",
    maxWidth: "min(840px, calc(100vw - 360px))",
    padding: "10px 14px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: "rgba(255, 253, 248, 0.92)",
    color: wm.colors.text,
    boxShadow: wm.shadow.overlay,
    backdropFilter: "blur(18px)",
    transform: "translateX(-50%)",
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    paddingRight: "6px",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  avatar: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    width: "50px",
    height: "50px",
    borderRadius: "999px",
    background: wm.colors.primary,
    color: wm.colors.surface,
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
    border: `3px solid ${wm.colors.surface}`,
  },
  statusText: {
    display: "grid",
    gap: "1px",
    minWidth: "96px",
    fontSize: "12px",
    lineHeight: 1.15,
  },
  statusLabel: {
    color: wm.colors.textMuted,
    fontSize: "10px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  divider: {
    width: "1px",
    height: "34px",
    background: wm.colors.border,
    margin: "0 4px",
  },
  action: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
    minWidth: "46px",
    minHeight: "46px",
    border: "1px solid transparent",
    borderRadius: "999px",
    background: "transparent",
    color: wm.colors.textSecondary,
    padding: "0 4px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 900,
    whiteSpace: "nowrap" as const,
  },
  actionDisabled: {
    color: wm.colors.textMuted,
    cursor: "not-allowed",
    opacity: 0.62,
  },
  emojiWrap: {
    position: "relative" as const,
    display: "grid",
    placeItems: "center",
  },
  emojiMenu: {
    position: "absolute" as const,
    left: "50%",
    bottom: "calc(100% + 14px)",
    display: "flex",
    gap: "4px",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "18px",
    background: "rgba(35, 31, 30, 0.96)",
    padding: "8px",
    boxShadow: wm.shadow.overlay,
    transform: "translateX(-50%)",
  },
  emojiButton: {
    display: "grid",
    placeItems: "center",
    width: "38px",
    height: "38px",
    border: 0,
    borderRadius: "10px",
    background: "transparent",
    cursor: "pointer",
    fontSize: "24px",
  },
  tooltip: {
    position: "absolute" as const,
    left: "50%",
    bottom: "calc(100% + 10px)",
    zIndex: 2,
    padding: "5px 9px",
    borderRadius: "7px",
    background: "rgba(16, 35, 63, 0.96)",
    color: wm.colors.surface,
    fontSize: "13px",
    fontWeight: 800,
    lineHeight: 1,
    opacity: 0,
    pointerEvents: "none" as const,
    transform: "translateX(-50%) translateY(4px)",
    transition: "opacity 120ms ease, transform 120ms ease",
  },
};
