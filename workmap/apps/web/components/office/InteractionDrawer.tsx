"use client";

import type { ContactTarget } from "@workmap/shared-types";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { OfficeIcon } from "./OfficeIcons";
import { labelStatus, statusColors } from "./presence";

type InteractionDrawerProps = {
  target: ContactTarget;
  onClose: () => void;
  onGoTo?: () => void;
  onOpenChat?: () => void;
  onSchedule?: () => void;
  onViewProfile?: () => void;
  onActionNote?: (message: string) => void;
};

export function InteractionDrawer({ target, onClose, onGoTo, onOpenChat, onSchedule, onViewProfile, onActionNote }: InteractionDrawerProps) {
  const firstName = target.displayName.split(" ")[0] ?? target.displayName;
  const guidance = getGuidance(target.status, firstName);
  const callDisabled = target.status === "focus" || target.status === "busy" || target.status === "offline";

  const handleAction = (action: string) => {
    if (action === "Message" && onOpenChat) {
      onOpenChat();
      return;
    }
    if (action === "Go to" && onGoTo) {
      onGoTo();
      return;
    }
    if (action === "Schedule meeting" && onSchedule) {
      onSchedule();
      return;
    }
    if (action === "View profile" && onViewProfile) {
      onViewProfile();
      return;
    }
    if (action === "Wave") {
      onActionNote?.(`You waved to ${target.displayName}. Local feedback only for this MVP.`);
      return;
    }
    if (action === "Teams") {
      onActionNote?.("Teams launcher is ready for future integration. No Teams content is read here.");
      return;
    }
    if (action === "Outlook") {
      onActionNote?.("Outlook contact action is a placeholder until contact links are configured.");
      return;
    }
    if (action === "3CX") {
      onActionNote?.("3CX calling is not connected yet. Use schedule or message for now.");
      return;
    }

    console.log(`WorkMap contact action: ${action}`, target);
  };

  return (
    <section className="wm-office-interaction-drawer" aria-label={`Interaction with ${target.displayName}`} style={styles.drawer}>
      <button aria-label="Close interaction drawer" style={styles.closeButton} onClick={onClose} type="button">
        <OfficeIcon name="close" size={18} />
      </button>

      <div style={styles.identity}>
        <div style={styles.portrait} aria-hidden="true">
          {getInitials(target.displayName)}
        </div>
        <div style={styles.identityText}>
          <div style={styles.nameRow}>
            <h2 style={styles.name}>{target.displayName}</h2>
            <span style={{ ...styles.statusDot, background: statusColors[target.status] }} />
          </div>
          <p style={styles.role}>{target.role}</p>
          <span style={styles.contextTag}>{labelStatus(target.status)}</span>
        </div>
      </div>

      <div style={styles.message}>
        <p style={styles.kicker}>People here</p>
        <h3 style={styles.greeting}>{guidance.title}</h3>
        <p style={styles.subtext}>{guidance.text}</p>
        <p style={styles.integrationNote}>External launchers are placeholders until Teams, Outlook, or 3CX links are configured.</p>
      </div>

      <div style={styles.actions}>
        <button style={styles.primaryAction} onClick={() => handleAction("Message")} type="button">
          Message
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Wave")} type="button">
          Wave
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Go to")} type="button">
          Go to
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Teams")} type="button">
          Teams
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Outlook")} type="button">
          Outlook
        </button>
        <button style={{ ...styles.actionButton, ...(callDisabled ? styles.actionButtonDisabled : {}) }} disabled={callDisabled} onClick={() => handleAction("3CX")} type="button">
          3CX Call
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("View profile")} type="button">
          View profile
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Schedule meeting")} type="button">
          Schedule
        </button>
      </div>
    </section>
  );
}

function getGuidance(status: ContactTarget["status"], firstName: string) {
  if (status === "focus") {
    return {
      title: `${firstName} is focusing`,
      text: "Use a quiet WorkMap message or schedule time instead of starting a call.",
    };
  }
  if (status === "busy") {
    return {
      title: `${firstName} looks busy`,
      text: "Schedule a meeting or leave an async note instead of interrupting.",
    };
  }
  if (status === "offline") {
    return {
      title: `${firstName} is offline`,
      text: "View their profile or leave an async note for later.",
    };
  }
  return {
    title: `Hi ${firstName}`,
    text: `${firstName} is available. Start with a message, wave, or go to their workspace area.`,
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const styles = {
  drawer: {
    ...wmStyles.elevatedCard,
    position: "absolute" as const,
    left: "342px",
    right: "96px",
    bottom: "30px",
    zIndex: wm.zIndex.officeDrawer,
    display: "grid",
    gridTemplateColumns: "minmax(220px, 0.8fr) minmax(250px, 0.85fr) minmax(430px, 1.35fr)",
    gap: "24px",
    alignItems: "center",
    minHeight: "150px",
    padding: "22px 58px 22px 24px",
    background: "rgba(255, 253, 248, 0.9)",
    color: wm.colors.text,
    backdropFilter: "blur(18px)",
  },
  closeButton: {
    position: "absolute" as const,
    top: "14px",
    right: "14px",
    display: "grid",
    placeItems: "center",
    width: "32px",
    height: "32px",
    border: 0,
    borderRadius: wm.radius.md,
    background: "transparent",
    color: wm.colors.textSecondary,
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 700,
  },
  identity: {
    display: "grid",
    gridTemplateColumns: "86px minmax(0, 1fr)",
    gap: "16px",
    alignItems: "center",
  },
  portrait: {
    display: "grid",
    placeItems: "center",
    width: "86px",
    height: "86px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "20px",
    background: "linear-gradient(180deg, #fffdf8, #e8f1ed)",
    color: wm.colors.primary,
    fontSize: "24px",
    fontWeight: 700,
  },
  identityText: {
    minWidth: 0,
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  name: {
    margin: 0,
    overflow: "hidden",
    color: wm.colors.text,
    fontSize: "22px",
    lineHeight: 1.15,
    fontWeight: 700,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  statusDot: {
    flex: "0 0 auto",
    width: "10px",
    height: "10px",
    borderRadius: "999px",
  },
  role: {
    margin: "6px 0 12px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    fontWeight: 750,
  },
  contextTag: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: "999px",
    background: wm.colors.surfaceContainer,
    color: wm.colors.primary,
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "capitalize" as const,
  },
  message: {
    minWidth: 0,
    paddingLeft: "24px",
    borderLeft: `1px solid ${wm.colors.border}`,
  },
  kicker: {
    margin: "0 0 8px",
    color: wm.colors.secondary,
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  greeting: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "21px",
    lineHeight: 1.2,
    fontWeight: 700,
  },
  subtext: {
    margin: "8px 0 0",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  integrationNote: {
    margin: "8px 0 0",
    color: wm.colors.textMuted,
    fontSize: "12px",
    lineHeight: 1.4,
    fontWeight: 750,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(104px, 1fr))",
    gap: "10px",
  },
  primaryAction: {
    ...wmStyles.primaryButton,
    minHeight: "48px",
    borderColor: wm.colors.secondary,
    borderRadius: "14px",
    background: wm.colors.secondary,
    fontSize: "13px",
    boxShadow: "0 14px 28px rgba(31, 122, 120, 0.18)",
  },
  actionButton: {
    ...wmStyles.secondaryButton,
    minHeight: "48px",
    borderRadius: "14px",
    background: "rgba(255, 253, 248, 0.86)",
    fontSize: "13px",
  },
  actionButtonDisabled: {
    color: "#94a3b8",
    cursor: "not-allowed",
    background: "rgba(248, 250, 252, 0.72)",
  },
};
