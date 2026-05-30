"use client";

type PolicyAcknowledgementModalProps = {
  open: boolean;
  onClose: () => void;
  onAcknowledge: () => void;
};

export function PolicyAcknowledgementModal({ open, onClose, onAcknowledge }: PolicyAcknowledgementModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div style={styles.backdrop} role="presentation">
      <section aria-modal="true" role="dialog" aria-labelledby="policy-title" style={styles.modal}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>Monitoring policy</p>
            <h2 id="policy-title" style={styles.title}>Acknowledge WorkMap visibility</h2>
          </div>
          <button type="button" aria-label="Close policy modal" onClick={onClose} style={styles.closeButton}>
            x
          </button>
        </div>

        <p style={styles.bodyText}>
          WorkMap records work metadata for presence, collaboration, and role-based reporting. This MVP policy is a mock
          frontend acknowledgement until backend audit logging and identity APIs are approved.
        </p>

        <div style={styles.grid}>
          <div style={styles.panel}>
            <h3 style={styles.smallTitle}>Collected</h3>
            <ul style={styles.list}>
              <li>Active app name</li>
              <li>Website domain</li>
              <li>Active/idle state</li>
              <li>Device heartbeat</li>
              <li>Work session timestamps</li>
            </ul>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.smallTitle}>Not collected</h3>
            <ul style={styles.list}>
              <li>Keystrokes</li>
              <li>Screenshots</li>
              <li>Camera or microphone</li>
              <li>Message or email content</li>
              <li>Passwords or form inputs</li>
            </ul>
          </div>
        </div>

        <div style={styles.actions}>
          <button type="button" onClick={onClose} style={styles.secondaryButton}>
            Review later
          </button>
          <button type="button" onClick={onAcknowledge} style={styles.primaryButton}>
            Acknowledge policy
          </button>
        </div>
      </section>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 30,
    display: "grid",
    placeItems: "center",
    background: "rgba(15, 23, 42, 0.42)",
    padding: "20px",
  },
  modal: {
    width: "min(760px, 100%)",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
    padding: "18px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    marginBottom: "12px",
  },
  eyebrow: {
    margin: "0 0 6px",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: "24px",
  },
  closeButton: {
    width: "32px",
    height: "32px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer",
    fontWeight: 900,
  },
  bodyText: {
    margin: "0 0 14px",
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  panel: {
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#f8fafc",
    padding: "14px",
  },
  smallTitle: {
    margin: "0 0 8px",
    fontSize: "16px",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "16px",
  },
  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: "6px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
