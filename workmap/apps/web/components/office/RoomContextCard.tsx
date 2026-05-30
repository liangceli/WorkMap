"use client";

import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";

type RoomContextCardProps = {
  destination: OfficeDestination;
  peopleCount: number;
  onGoTo: () => void;
  onViewPeople: () => void;
  onClose: () => void;
};

export function RoomContextCard({ destination, peopleCount, onGoTo, onViewPeople, onClose }: RoomContextCardProps) {
  return (
    <aside style={styles.card} aria-label={`${destination.name} context`}>
      <button type="button" aria-label="Close room context" onClick={onClose} style={styles.closeButton}>
        x
      </button>
      <p style={styles.eyebrow}>{destination.type.replace("_", " ")}</p>
      <h2 style={styles.title}>{destination.name}</h2>
      <p style={styles.text}>{destination.description ?? "WorkMap office area."}</p>
      <p style={styles.meta}>{peopleCount} people nearby in mock presence</p>
      <div style={styles.actions}>
        <button type="button" onClick={onGoTo} style={styles.primaryButton}>Go to</button>
        <button type="button" onClick={onViewPeople} style={styles.secondaryButton}>View people</button>
        <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)} style={styles.secondaryButton}>
          Copy link
        </button>
      </div>
    </aside>
  );
}

const styles = {
  card: {
    position: "absolute" as const,
    top: "96px",
    right: "24px",
    zIndex: 34,
    width: "300px",
    border: "1px solid rgba(203, 213, 225, 0.84)",
    borderRadius: "16px",
    background: "rgba(255, 255, 255, 0.92)",
    padding: "16px",
    color: "#0f172a",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.16)",
    backdropFilter: "blur(16px)",
  },
  closeButton: {
    position: "absolute" as const,
    top: "10px",
    right: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#475569",
    cursor: "pointer",
    fontWeight: 900,
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: "0 0 8px",
    fontSize: "22px",
  },
  text: {
    margin: "0 0 10px",
    color: "#475569",
    fontSize: "14px",
    lineHeight: 1.45,
  },
  meta: {
    margin: "0 0 12px",
    color: "#334155",
    fontSize: "13px",
    fontWeight: 800,
  },
  actions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "9px",
    cursor: "pointer",
    fontWeight: 900,
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "9px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
