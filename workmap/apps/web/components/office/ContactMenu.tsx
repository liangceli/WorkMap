import type { ContactTarget } from "@workmap/shared-types";
import { PresenceBadge } from "./PresenceBadge";

type ContactMenuProps = {
  target: ContactTarget;
  onClose: () => void;
};

export function ContactMenu({ target, onClose }: ContactMenuProps) {
  return (
    <section style={styles.contactCard}>
      <button aria-label="Close contact menu" style={styles.closeButton} onClick={onClose} type="button">
        x
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
    position: "relative" as const,
    border: "1px solid #94a3b8",
    background: "#ffffff",
    borderRadius: "8px",
    padding: "14px",
    boxShadow: "0 16px 35px rgba(15, 23, 42, 0.12)",
  },
  panelLabel: {
    margin: "0 0 6px",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  panelTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
  },
  panelText: {
    margin: "0 0 10px",
    color: "#334155",
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
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: "6px",
    padding: "8px",
    color: "#0f172a",
    cursor: "pointer",
  },
  closeButton: {
    position: "absolute" as const,
    top: "10px",
    right: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#ffffff",
    cursor: "pointer",
  },
};
