"use client";

import type { ContactTarget } from "@workmap/shared-types";
import { labelStatus, statusColors } from "./presence";

type InteractionDrawerProps = {
  target: ContactTarget;
  onClose: () => void;
  onGoTo?: () => void;
  onOpenChat?: () => void;
  onSchedule?: () => void;
  onViewProfile?: () => void;
};

export function InteractionDrawer({ target, onClose, onGoTo, onOpenChat, onSchedule, onViewProfile }: InteractionDrawerProps) {
  const firstName = target.displayName.split(" ")[0] ?? target.displayName;

  const handleAction = (action: string) => {
    if (action === "Instant Message" && onOpenChat) {
      onOpenChat();
      return;
    }
    if (action === "Go to" && onGoTo) {
      onGoTo();
      return;
    }
    if (action === "Schedule Meeting" && onSchedule) {
      onSchedule();
      return;
    }
    if (action === "View Profile" && onViewProfile) {
      onViewProfile();
      return;
    }
    if (action === "Outlook") {
      window.location.href = `mailto:${target.userId}@workmap.local`;
      return;
    }

    console.log(`WorkMap contact action: ${action}`, target);
  };

  return (
    <section aria-label={`Interaction with ${target.displayName}`} style={styles.drawer}>
      <button aria-label="Close interaction drawer" style={styles.closeButton} onClick={onClose} type="button">
        x
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
          <span style={styles.contextTag}>
            <span style={styles.tagIcon}>Desk</span>
            {labelStatus(target.status)}
          </span>
        </div>
      </div>

      <div style={styles.message}>
        <h3 style={styles.greeting}>Hi {firstName}!</h3>
        <p style={styles.subtext}>How can I help you today?</p>
        <div style={styles.reactions} aria-label="Quick reactions">
          <button style={styles.reactionButton} onClick={() => handleAction("Thumbs up")} type="button">
            Like
          </button>
          <button style={styles.reactionButton} onClick={() => handleAction("Smile")} type="button">
            Smile
          </button>
          <button style={styles.reactionButton} onClick={() => handleAction("Wave reaction")} type="button">
            Wave
          </button>
        </div>
      </div>

      <div style={styles.actions}>
        <button style={styles.actionButton} onClick={() => handleAction("Instant Message")} type="button">
          <span style={styles.actionIcon}>IM</span>
          Instant Message
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Emoji")} type="button">
          <span style={styles.actionIcon}>:)</span>
          Emoji
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Wave")} type="button">
          <span style={styles.actionIcon}>Hi</span>
          Wave
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Go to")} type="button">
          <span style={styles.actionIcon}>Go</span>
          Go to
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Teams")} type="button">
          <span style={styles.actionIcon}>T</span>
          Teams
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Outlook")} type="button">
          <span style={styles.actionIcon}>O</span>
          Outlook
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("3CX")} type="button">
          <span style={styles.actionIcon}>3C</span>
          3CX
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("View Profile")} type="button">
          <span style={styles.actionIcon}>VP</span>
          View Profile
        </button>
        <button style={styles.actionButton} onClick={() => handleAction("Schedule Meeting")} type="button">
          <span style={styles.actionIcon}>Cal</span>
          Schedule
        </button>
      </div>
    </section>
  );
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
    position: "absolute" as const,
    left: "50%",
    bottom: "24px",
    zIndex: 30,
    display: "grid",
    gridTemplateColumns: "minmax(240px, 0.9fr) minmax(240px, 0.8fr) minmax(520px, 1.5fr)",
    gap: "24px",
    alignItems: "center",
    width: "min(1360px, 86vw)",
    minHeight: "150px",
    padding: "20px 56px 20px 22px",
    border: "1px solid rgba(203, 213, 225, 0.82)",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.92)",
    color: "#111827",
    boxShadow: "0 28px 70px rgba(15, 23, 42, 0.24)",
    backdropFilter: "blur(18px)",
    transform: "translateX(-50%)",
  },
  closeButton: {
    position: "absolute" as const,
    top: "12px",
    right: "12px",
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    background: "rgba(248, 250, 252, 0.9)",
    color: "#475569",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: 800,
  },
  identity: {
    display: "grid",
    gridTemplateColumns: "108px minmax(0, 1fr)",
    gap: "16px",
    alignItems: "center",
  },
  portrait: {
    display: "grid",
    placeItems: "center",
    width: "108px",
    height: "108px",
    border: "1px solid #cbd5e1",
    borderRadius: "18px",
    background: "linear-gradient(180deg, #f8fafc, #e2e8f0)",
    color: "#25346f",
    fontSize: "30px",
    fontWeight: 900,
    boxShadow: "inset 0 -16px 28px rgba(15, 23, 42, 0.08)",
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
    color: "#0f172a",
    fontSize: "24px",
    lineHeight: 1.15,
    fontWeight: 850,
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
    color: "#475569",
    fontSize: "15px",
    fontWeight: 650,
  },
  contextTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 10px",
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 800,
    textTransform: "capitalize" as const,
  },
  tagIcon: {
    color: "#64748b",
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  message: {
    minWidth: 0,
    paddingLeft: "22px",
    borderLeft: "1px solid #e2e8f0",
  },
  greeting: {
    margin: 0,
    color: "#0f172a",
    fontSize: "22px",
    lineHeight: 1.2,
    fontWeight: 850,
  },
  subtext: {
    margin: "8px 0 18px",
    color: "#475569",
    fontSize: "15px",
    lineHeight: 1.4,
    fontWeight: 600,
  },
  reactions: {
    display: "flex",
    gap: "10px",
  },
  reactionButton: {
    minWidth: "56px",
    height: "38px",
    border: "1px solid #e2e8f0",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#1f2937",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 850,
    boxShadow: "0 8px 20px rgba(15, 23, 42, 0.08)",
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(116px, 1fr))",
    gap: "12px",
  },
  actionButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    minHeight: "52px",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#1f2937",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 850,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
  },
  actionIcon: {
    display: "grid",
    placeItems: "center",
    minWidth: "26px",
    height: "26px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#2563eb",
    fontSize: "11px",
    fontWeight: 900,
  },
};
