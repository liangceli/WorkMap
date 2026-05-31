"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ContactTarget } from "@workmap/shared-types";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import { OfficeIcon } from "./OfficeIcons";
import type { RemoteOfficePlayer } from "./mockOfficeData";
import { labelStatus, statusColors } from "./presence";

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
    <div style={styles.backdrop} role="dialog" aria-label="Office search" onMouseDown={onClose}>
      <section style={styles.palette} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find people, rooms, or actions..."
            style={styles.input}
          />
          <button type="button" aria-label="Close office search" onClick={onClose} style={styles.closeButton}>
            <OfficeIcon name="close" size={20} />
          </button>
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
                <span>{person.role} / {person.roomId?.replaceAll("-", " ") ?? "Office area"}</span>
              </span>
              <span style={styles.statusPill}>
                <span style={{ ...styles.statusDot, background: statusColors[person.status] }} />
                {labelStatus(person.status)}
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
              <span style={styles.roomAvatar}>{destination.name.slice(0, 1)}</span>
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
              <span style={styles.roomAvatar}>A</span>
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
    zIndex: wm.zIndex.officeModal,
    display: "grid",
    placeItems: "start center",
    paddingTop: "112px",
    background: "rgba(15, 23, 42, 0.24)",
    backdropFilter: "blur(4px)",
  },
  palette: {
    ...wmStyles.elevatedCard,
    width: "min(700px, calc(100vw - 48px))",
    maxHeight: "min(720px, calc(100vh - 128px))",
    overflow: "auto",
    background: "rgba(255, 255, 255, 0.92)",
    backdropFilter: "blur(24px)",
    padding: "16px",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "10px",
    marginBottom: "14px",
  },
  input: {
    ...wmStyles.input,
    height: "52px",
    borderRadius: wm.radius.xl,
    padding: "0 14px",
    fontSize: "15px",
  },
  closeButton: {
    display: "grid",
    placeItems: "center",
    width: "42px",
    height: "42px",
    border: 0,
    borderRadius: wm.radius.xl,
    background: "transparent",
    color: wm.colors.textSecondary,
    cursor: "pointer",
  },
  group: {
    display: "grid",
    gap: "8px",
    marginBottom: "14px",
  },
  groupTitle: {
    ...wmStyles.eyebrow,
    color: wm.colors.textMuted,
    margin: 0,
  },
  resultStack: {
    display: "grid",
    gap: "8px",
  },
  resultRow: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr) auto auto",
    gap: "12px",
    alignItems: "center",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.xl,
    background: "rgba(255, 255, 255, 0.86)",
    padding: "10px",
    color: wm.colors.text,
    cursor: "pointer",
    textAlign: "left" as const,
  },
  avatar: {
    display: "grid",
    placeItems: "center",
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    background: wm.colors.surfaceContainer,
    color: wm.colors.primaryContainer,
    fontWeight: 900,
  },
  roomAvatar: {
    display: "grid",
    placeItems: "center",
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    background: wm.colors.surfaceContainer,
    color: wm.colors.primaryContainer,
    fontWeight: 900,
  },
  resultText: {
    display: "grid",
    gap: "3px",
    minWidth: 0,
    fontSize: "13px",
    color: wm.colors.textMuted,
  },
  actionText: {
    borderRadius: "999px",
    background: wm.colors.background,
    color: wm.colors.primaryContainer,
    padding: "6px 9px",
    fontSize: "12px",
    fontWeight: 900,
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: wm.colors.textSecondary,
    fontSize: "12px",
    fontWeight: 900,
  },
  statusDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    border: `2px solid ${wm.colors.surface}`,
  },
};
