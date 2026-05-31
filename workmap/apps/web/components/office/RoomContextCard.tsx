"use client";

import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type RoomContextCardProps = {
  destination: OfficeDestination;
  peopleCount: number;
  onGoTo: () => void;
  onViewPeople: () => void;
  onClose: () => void;
};

export function RoomContextCard({ destination, peopleCount, onGoTo, onViewPeople, onClose }: RoomContextCardProps) {
  const isFocusRoom = destination.name.toLowerCase().includes("focus");
  const isMeetingRoom = destination.name.toLowerCase().includes("meeting");

  return (
    <aside style={styles.card} aria-label={`${destination.name} context`}>
      <button type="button" aria-label="Close room context" onClick={onClose} style={styles.closeButton}>
        x
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
      <p style={styles.meta}>{peopleCount} people here</p>
      <div style={styles.actions}>
        <button type="button" onClick={onGoTo} style={styles.primaryButton}>Go to room</button>
        {isFocusRoom ? (
          <button type="button" onClick={() => undefined} style={styles.secondaryButton}>Start focus session</button>
        ) : (
          <button type="button" onClick={onViewPeople} style={styles.secondaryButton}>View people</button>
        )}
        <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)} style={styles.secondaryButton}>
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
    width: "336px",
    background: "rgba(255, 255, 255, 0.78)",
    padding: "24px",
    color: wm.colors.text,
    backdropFilter: "blur(24px)",
  },
  closeButton: {
    position: "absolute" as const,
    top: "12px",
    right: "12px",
    display: "grid",
    placeItems: "center",
    width: "30px",
    height: "30px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: "rgba(255, 255, 255, 0.82)",
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
    background: "rgba(219, 225, 255, 0.74)",
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
    background: wm.colors.primaryContainer,
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
    color: wm.colors.primaryContainer,
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
    color: wm.colors.primaryContainer,
    fontSize: "13px",
    fontWeight: 700,
  },
  actions: {
    display: "grid",
    gap: "10px",
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    borderColor: wm.colors.primaryContainer,
    borderRadius: "14px",
    background: wm.colors.primaryContainer,
    padding: "13px",
    boxShadow: "0 16px 30px rgba(22, 35, 90, 0.22)",
  },
  secondaryButton: {
    ...wmStyles.secondaryButton,
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.84)",
    padding: "12px",
  },
};
