"use client";

import { useState } from "react";
import { PolicyAcknowledgementModal } from "./PolicyAcknowledgementModal";

const collectedItems = [
  "App name",
  "Website domain",
  "Active / idle state",
  "Device heartbeat",
  "Session time",
];

const notCollectedItems = [
  "Keystrokes",
  "Screenshots",
  "Camera",
  "Microphone",
  "Teams message content",
  "Outlook email body",
  "Full URLs by default",
  "Form inputs",
  "Passwords",
];

export function CompliancePolicyPanel() {
  const [modalOpen, setModalOpen] = useState(false);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);

  return (
    <div style={styles.stack}>
      <section style={styles.policyGrid}>
        <PolicyList title="Collected" tone="blue" items={collectedItems} />
        <PolicyList title="Not collected" tone="green" items={notCollectedItems} />
      </section>

      <section style={styles.ackPanel}>
        <div>
          <p style={styles.panelLabel}>Policy acknowledgement</p>
          <h2 style={styles.panelTitle}>{acknowledgedAt ? "Acknowledged in this browser" : "Employee notice preview"}</h2>
          <p style={styles.panelText}>
            {acknowledgedAt
              ? `Mock acknowledgement recorded locally at ${acknowledgedAt}.`
              : "Preview the first-time notice employees will see before monitoring metadata is enabled."}
          </p>
        </div>
        <button type="button" onClick={() => setModalOpen(true)} style={styles.primaryButton}>
          Preview acknowledgement
        </button>
      </section>

      <PolicyAcknowledgementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAcknowledge={() => {
          setAcknowledgedAt(new Date().toLocaleString());
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function PolicyList({ title, tone, items }: { title: string; tone: "blue" | "green"; items: string[] }) {
  return (
    <section style={styles.policyCard}>
      <div style={{ ...styles.accent, background: tone === "blue" ? "#2563eb" : "#16a34a" }} />
      <h2 style={styles.policyTitle}>{title}</h2>
      <ul style={styles.list}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

const styles = {
  stack: {
    display: "grid",
    gap: "14px",
  },
  policyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
  },
  policyCard: {
    position: "relative" as const,
    overflow: "hidden",
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
  },
  accent: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "3px",
  },
  policyTitle: {
    margin: "0 0 12px",
    fontSize: "20px",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.8,
  },
  ackPanel: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    padding: "16px",
  },
  panelLabel: {
    margin: "0 0 8px",
    color: "#1d4ed8",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  panelTitle: {
    margin: "0 0 6px",
    fontSize: "19px",
  },
  panelText: {
    margin: 0,
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  primaryButton: {
    flex: "0 0 auto",
    border: "1px solid #0f172a",
    borderRadius: "6px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
