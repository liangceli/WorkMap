"use client";

import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { OfficeIcon } from "./OfficeIcons";

type RoomContextCardProps = {
  destination: OfficeDestination;
  peopleCount: number;
  onGoTo: () => void;
  onViewPeople: () => void;
  onClose: () => void;
  onNotice?: (message: string) => void;
};

export function RoomContextCard({ destination, peopleCount, onGoTo, onViewPeople, onClose, onNotice }: RoomContextCardProps) {
  const isFocusRoom = destination.name.toLowerCase().includes("focus");
  const isMeetingRoom = destination.name.toLowerCase().includes("meeting");

  return (
    <aside className="wm-office-room-card" style={styles.card} aria-label={`${destination.name} context`}>
      <button type="button" aria-label="Close room context" onClick={onClose} style={styles.closeButton}>
        <OfficeIcon name="close" size={18} />
      </button>
      <div style={styles.topRow}>
        <span style={styles.badge}>{roomBadge(destination, isFocusRoom, isMeetingRoom)}</span>
        <span style={styles.avatarStack}>
          <span style={styles.avatarDot} />
          <span style={styles.avatarDot} />
          <span style={styles.avatarMore}>+{Math.max(peopleCount, 1)}</span>
        </span>
      </div>
      <h2 style={styles.title}>{destination.name}</h2>
      <p style={styles.text}>{roomDescription(destination, isFocusRoom, isMeetingRoom)}</p>
      <p style={styles.meta}>{peopleCount} teammate{peopleCount === 1 ? "" : "s"} here</p>
      <div style={styles.actions}>
        <button type="button" onClick={onGoTo} style={styles.primaryButton}>Go to room</button>
        {isFocusRoom ? (
          <button type="button" onClick={() => onNotice?.("Focus sessions are not persisted yet. Use the room presence cue for now.")} style={styles.secondaryButton}>Focus cue</button>
        ) : (
          <button type="button" onClick={onViewPeople} style={styles.secondaryButton}>View people</button>
        )}
        <button type="button" onClick={() => {
          navigator.clipboard?.writeText(window.location.href);
          onNotice?.("Office link copied.");
        }} style={styles.secondaryButton}>
          Copy link
        </button>
      </div>
    </aside>
  );
}

function roomBadge(destination: OfficeDestination, isFocusRoom: boolean, isMeetingRoom: boolean) {
  if (isFocusRoom) {
    return "Focus space";
  }
  if (isMeetingRoom) {
    return "Meeting space";
  }
  return destination.type.replace("_", " ");
}

function roomDescription(destination: OfficeDestination, isFocusRoom: boolean, isMeetingRoom: boolean) {
  if (isFocusRoom) {
    return "A quiet space for deep work. People here may prefer async messages and fewer interruptions.";
  }
  if (isMeetingRoom) {
    return "People in this room may be in a scheduled or ad-hoc meeting.";
  }
  return destination.description ?? "A WorkMap office area for presence and collaboration.";
}

const styles = {
  card: {
    ...wmStyles.elevatedCard,
    position: "absolute" as const,
    top: "132px",
    right: "92px",
    zIndex: 34,
    width: "340px",
    background: "rgba(255, 253, 248, 0.9)",
    padding: "22px",
    color: wm.colors.text,
    backdropFilter: "blur(18px)",
  },
  closeButton: {
    position: "absolute" as const,
    top: "12px",
    right: "12px",
    display: "grid",
    placeItems: "center",
    width: "30px",
    height: "30px",
    border: 0,
    borderRadius: wm.radius.md,
    background: "transparent",
    color: wm.colors.textSecondary,
    cursor: "pointer",
    fontWeight: 700,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginRight: "34px",
    marginBottom: "16px",
  },
  badge: {
    display: "inline-flex",
    border: `1px solid ${wm.colors.surfaceHigh}`,
    borderRadius: "999px",
    background: "rgba(31, 122, 120, 0.1)",
    color: wm.colors.secondary,
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  avatarStack: {
    display: "inline-flex",
    alignItems: "center",
  },
  avatarDot: {
    width: "22px",
    height: "22px",
    marginLeft: "-6px",
    border: `2px solid ${wm.colors.surface}`,
    borderRadius: "999px",
    background: wm.colors.primary,
  },
  avatarMore: {
    display: "grid",
    placeItems: "center",
    width: "24px",
    height: "24px",
    marginLeft: "-6px",
    border: `2px solid ${wm.colors.surface}`,
    borderRadius: "999px",
    background: wm.colors.surfaceContainer,
    color: wm.colors.primary,
    fontSize: "10px",
    fontWeight: 700,
  },
  title: {
    margin: "0 0 10px",
    color: wm.colors.text,
    fontSize: "22px",
    fontWeight: 700,
  },
  text: {
    margin: "0 0 14px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.55,
    fontWeight: 600,
  },
  meta: {
    margin: "0 0 16px",
    color: wm.colors.primary,
    fontSize: "13px",
    fontWeight: 700,
  },
  actions: {
    display: "grid",
    gap: "10px",
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    borderColor: wm.colors.secondary,
    borderRadius: "14px",
    background: wm.colors.secondary,
    padding: "13px",
    boxShadow: "0 14px 28px rgba(31, 122, 120, 0.18)",
  },
  secondaryButton: {
    ...wmStyles.secondaryButton,
    borderRadius: "14px",
    background: "rgba(255, 253, 248, 0.8)",
    padding: "12px",
  },
};
