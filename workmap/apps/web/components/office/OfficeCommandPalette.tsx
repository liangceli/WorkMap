"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ContactTarget } from "@workmap/shared-types";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import type { RemoteOfficePlayer } from "./mockOfficeData";

type OfficeCommandPaletteProps = {
  open: boolean;
  people: RemoteOfficePlayer[];
  destinations: OfficeDestination[];
  onClose: () => void;
  onSelectPerson: (target: ContactTarget) => void;
  onGoToPerson: (player: RemoteOfficePlayer) => void;
  onSelectDestination: (destination: OfficeDestination) => void;
  onGoToDestination: (destination: OfficeDestination) => void;
  onNavigate: (href: string) => void;
};

const actions = [
  { id: "dashboard", title: "Open dashboard", subtitle: "Review team visibility", href: "/dashboard" },
  { id: "compliance", title: "Review compliance", subtitle: "Collected and not collected policy", href: "/compliance" },
  { id: "integrations", title: "Open integrations", subtitle: "Teams, Outlook, calendar, and 3CX links", href: "/integrations" },
  { id: "away", title: "Set yourself as away", subtitle: "Frontend-only status placeholder", href: "" },
];

export function OfficeCommandPalette({
  open,
  people,
  destinations,
  onClose,
  onSelectPerson,
  onGoToPerson,
  onSelectDestination,
  onGoToDestination,
  onNavigate,
}: OfficeCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();

  const filteredPeople = useMemo(
    () =>
      people.filter((person) =>
        `${person.displayName} ${person.role} ${person.roomId ?? ""}`.toLowerCase().includes(normalized),
      ),
    [normalized, people],
  );
  const filteredDestinations = useMemo(
    () =>
      destinations.filter((destination) =>
        `${destination.name} ${destination.type} ${destination.description ?? ""}`.toLowerCase().includes(normalized),
      ),
    [destinations, normalized],
  );
  const filteredActions = useMemo(
    () => actions.filter((action) => `${action.title} ${action.subtitle}`.toLowerCase().includes(normalized)),
    [normalized],
  );

  if (!open) {
    return null;
  }

  return (
    <div style={styles.backdrop} role="dialog" aria-label="Office search">
      <section style={styles.palette}>
        <div style={styles.header}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, rooms, departments, or actions"
            style={styles.input}
          />
          <button type="button" onClick={onClose} style={styles.closeButton}>Esc</button>
        </div>

        <ResultGroup title="People">
          {filteredPeople.map((person) => (
            <button
              key={person.userId}
              type="button"
              style={styles.resultRow}
              onClick={() =>
                onSelectPerson({
                  userId: person.userId,
                  displayName: person.displayName,
                  role: person.role,
                  status: person.status,
                })
              }
            >
              <span style={styles.avatar}>{person.displayName.slice(0, 1)}</span>
              <span style={styles.resultText}>
                <strong>{person.displayName}</strong>
                <span>{person.role} / {person.status.replace("_", " ")}</span>
              </span>
              <span style={styles.actionText} onClick={(event) => { event.stopPropagation(); onGoToPerson(person); }}>Go to</span>
            </button>
          ))}
        </ResultGroup>

        <ResultGroup title="Rooms and sections">
          {filteredDestinations.map((destination) => (
            <button
              key={destination.id}
              type="button"
              style={styles.resultRow}
              onClick={() => onSelectDestination(destination)}
            >
              <span style={styles.avatar}>{destination.name.slice(0, 1)}</span>
              <span style={styles.resultText}>
                <strong>{destination.name}</strong>
                <span>{destination.type.replace("_", " ")} / {destination.description}</span>
              </span>
              <span style={styles.actionText} onClick={(event) => { event.stopPropagation(); onGoToDestination(destination); }}>Go to</span>
            </button>
          ))}
        </ResultGroup>

        <ResultGroup title="Actions">
          {filteredActions.map((action) => (
            <button
              key={action.id}
              type="button"
              style={styles.resultRow}
              onClick={() => {
                if (action.href) {
                  onNavigate(action.href);
                }
                onClose();
              }}
            >
              <span style={styles.avatar}>A</span>
              <span style={styles.resultText}>
                <strong>{action.title}</strong>
                <span>{action.subtitle}</span>
              </span>
              <span style={styles.actionText}>Open</span>
            </button>
          ))}
        </ResultGroup>
      </section>
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={styles.group}>
      <p style={styles.groupTitle}>{title}</p>
      <div style={styles.resultStack}>{children}</div>
    </section>
  );
}

const styles = {
  backdrop: {
    position: "absolute" as const,
    inset: 0,
    zIndex: 60,
    display: "grid",
    placeItems: "start center",
    paddingTop: "92px",
    background: "rgba(15, 23, 42, 0.18)",
    backdropFilter: "blur(2px)",
  },
  palette: {
    width: "min(720px, calc(100vw - 48px))",
    maxHeight: "min(720px, calc(100vh - 128px))",
    overflow: "auto",
    border: "1px solid rgba(203, 213, 225, 0.9)",
    borderRadius: "18px",
    background: "#ffffff",
    boxShadow: "0 28px 70px rgba(15, 23, 42, 0.24)",
    padding: "14px",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    marginBottom: "14px",
  },
  input: {
    height: "46px",
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    padding: "0 14px",
    color: "#0f172a",
    fontSize: "15px",
  },
  closeButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "12px",
    background: "#f8fafc",
    color: "#475569",
    padding: "0 12px",
    cursor: "pointer",
    fontWeight: 900,
  },
  group: {
    display: "grid",
    gap: "8px",
    marginBottom: "14px",
  },
  groupTitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  resultStack: {
    display: "grid",
    gap: "8px",
  },
  resultRow: {
    display: "grid",
    gridTemplateColumns: "38px minmax(0, 1fr) auto",
    gap: "10px",
    alignItems: "center",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#ffffff",
    padding: "9px",
    color: "#0f172a",
    cursor: "pointer",
    textAlign: "left" as const,
  },
  avatar: {
    display: "grid",
    placeItems: "center",
    width: "38px",
    height: "38px",
    borderRadius: "12px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 900,
  },
  resultText: {
    display: "grid",
    gap: "3px",
    minWidth: 0,
    fontSize: "13px",
    color: "#64748b",
  },
  actionText: {
    borderRadius: "999px",
    background: "#f1f5f9",
    color: "#334155",
    padding: "6px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },
};
