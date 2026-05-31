import type { ContactTarget } from "@workmap/shared-types";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { OfficeIcon } from "./OfficeIcons";
import { PresenceBadge } from "./PresenceBadge";

type ContactMenuProps = {
  target: ContactTarget;
  onClose: () => void;
};

export function ContactMenu({ target, onClose }: ContactMenuProps) {
  return (
    <section style={styles.contactCard}>
      <button aria-label="Close contact menu" style={styles.closeButton} onClick={onClose} type="button">
        <OfficeIcon name="close" size={18} />
      </button>
      <p style={styles.panelLabel}>Contact</p>
      <h2 style={styles.panelTitle}>{target.displayName}</h2>
      <p style={styles.panelText}>{target.role}</p>
      <PresenceBadge status={target.status} />
      <div style={styles.actions}>
        <button style={styles.actionButton} type="button">
          Teams Chat
        </button>
        <button style={styles.actionButton} type="button">
          Outlook Email
        </button>
        <button style={styles.actionButton} type="button">
          3CX Call
        </button>
        <button style={styles.actionButton} type="button">
          Schedule
        </button>
        <button style={styles.actionButton} type="button">
          View Profile
        </button>
      </div>
    </section>
  );
}

const styles = {
  contactCard: {
    ...wmStyles.elevatedCard,
    position: "relative" as const,
    padding: "14px",
  },
  panelLabel: {
    ...wmStyles.eyebrow,
    color: wm.colors.textMuted,
  },
  panelTitle: {
    margin: "0 0 8px",
    color: wm.colors.text,
    fontSize: "20px",
    fontWeight: 700,
  },
  panelText: {
    margin: "0 0 10px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "12px",
  },
  actionButton: {
    ...wmStyles.secondaryButton,
    padding: "8px",
  },
  closeButton: {
    position: "absolute" as const,
    top: "10px",
    right: "10px",
    display: "grid",
    placeItems: "center",
    width: "32px",
    height: "32px",
    border: 0,
    borderRadius: wm.radius.md,
    background: "transparent",
    color: wm.colors.text,
    cursor: "pointer",
  },
};
