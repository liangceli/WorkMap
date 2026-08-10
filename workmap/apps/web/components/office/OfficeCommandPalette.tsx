"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ContactTarget } from "@workmap/shared-types";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import { getUserSetupState, type WorkMapRole } from "../../lib/workflow/workflowState";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import { OfficeIcon } from "./OfficeIcons";
import type { RemoteOfficePlayer } from "./mockOfficeData";
import { presenceFreshnessLabel, statusColors } from "./presence";

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

const actions: Array<{ id: string; title: string; subtitle: string; href: string; roles: WorkMapRole[] }> = [
  { id: "dashboard", title: "Open dashboard", subtitle: "Review team visibility", href: "/dashboard", roles: ["MANAGER", "OWNER"] },
  {
    id: "compliance",
    title: "Review monitoring notice",
    subtitle: "Employee monitoring data boundaries",
    href: "/compliance",
    roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"],
  },
  {
    id: "integrations",
    title: "Open integrations",
    subtitle: "Teams, Outlook, and calendar links",
    href: "/integrations",
    roles: ["OWNER", "IT_ADMIN"],
  },
  {
    id: "away",
    title: "Set yourself as away",
    subtitle: "Frontend-only status placeholder",
    href: "",
    roles: ["EMPLOYEE", "MANAGER", "OWNER", "IT_ADMIN"],
  },
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
  const [activeRole, setActiveRole] = useState<WorkMapRole | null>(null);
  const normalized = query.trim().toLowerCase();
  const roomNameById = useMemo(() => createRoomNameMap(destinations), [destinations]);

  useEffect(() => {
    setActiveRole(getUserSetupState()?.role ?? null);
  }, [open]);

  const filteredPeople = useMemo(
    () =>
      people.filter((person) =>
        `${person.displayName} ${person.role} ${friendlyRoom(person.roomId, roomNameById)}`.toLowerCase().includes(normalized),
      ),
    [normalized, people, roomNameById],
  );
  const filteredDestinations = useMemo(
    () =>
      destinations.filter((destination) =>
        `${destination.name} ${destination.type} ${destination.description ?? ""}`.toLowerCase().includes(normalized),
      ),
    [destinations, normalized],
  );
  const filteredActions = useMemo(
    () =>
      actions.filter((action) => {
        const visibleForRole = activeRole ? action.roles.includes(activeRole) : action.href === "/compliance" || action.id === "away";
        return visibleForRole && `${action.title} ${action.subtitle}`.toLowerCase().includes(normalized);
      }),
    [activeRole, normalized],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="wm-office-command-backdrop" style={styles.backdrop} role="dialog" aria-label="Office search" onMouseDown={onClose}>
      <section className="wm-office-command-palette" style={styles.palette} onMouseDown={(event) => event.stopPropagation()}>
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
          {filteredPeople.length > 0 ? (
            filteredPeople.map((person) => {
              const freshness = presenceFreshnessLabel(person.updatedAt, person.status);
              return (
                <button
                  key={person.userId}
                  type="button"
                  className="wm-command-result-row"
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
                    <span>{person.role} / {friendlyRoom(person.roomId, roomNameById)}</span>
                  </span>
                  <span style={styles.statusColumn}>
                    <span style={styles.statusPill}>
                      <span style={{ ...styles.statusDot, background: statusColors[person.status] }} />
                      {freshness.label}
                    </span>
                    <span style={styles.lastSeen}>{freshness.detail}</span>
                  </span>
                  <span style={styles.actionText} onClick={(event) => { event.stopPropagation(); onGoToPerson(person); }}>Go to</span>
                </button>
              );
            })
          ) : (
            <div style={styles.emptyRow}>No teammates match this search.</div>
          )}
        </ResultGroup>

        <ResultGroup title="Rooms and sections">
          {filteredDestinations.map((destination) => (
            <button
              key={destination.id}
              type="button"
              className="wm-command-result-row"
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
              className="wm-command-result-row"
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

function createRoomNameMap(destinations: OfficeDestination[]) {
  const entries = new Map<string, string>();

  for (const destination of destinations) {
    entries.set(destination.id, destination.name);
    if (destination.roomId) {
      entries.set(destination.roomId, destination.name);
    }
  }

  return entries;
}

function friendlyRoom(roomId: string | undefined, roomNameById: Map<string, string>) {
  if (!roomId) {
    return "Office area";
  }

  return roomNameById.get(roomId) ?? "Office area";
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
    background: "rgba(16, 32, 51, 0.22)",
    backdropFilter: "blur(4px)",
  },
  palette: {
    ...wmStyles.elevatedCard,
    width: "min(700px, calc(100vw - 48px))",
    maxHeight: "min(720px, calc(100vh - 128px))",
    overflow: "auto",
    background: "rgba(255, 253, 248, 0.94)",
    backdropFilter: "blur(18px)",
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
    background: "rgba(255, 253, 248, 0.86)",
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
    color: wm.colors.primary,
    fontWeight: 900,
  },
  roomAvatar: {
    display: "grid",
    placeItems: "center",
    width: "42px",
    height: "42px",
    borderRadius: "14px",
    background: wm.colors.surfaceContainer,
    color: wm.colors.primary,
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
    color: wm.colors.primary,
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
  statusColumn: {
    display: "grid",
    justifyItems: "end",
    gap: "2px",
    minWidth: "104px",
  },
  lastSeen: {
    color: wm.colors.textMuted,
    fontSize: "10px",
    fontWeight: 800,
    whiteSpace: "nowrap" as const,
  },
  statusDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    border: `2px solid ${wm.colors.surface}`,
  },
  emptyRow: {
    border: `1px dashed ${wm.colors.border}`,
    borderRadius: wm.radius.xl,
    background: "rgba(255, 253, 248, 0.72)",
    color: wm.colors.textMuted,
    padding: "14px",
    fontSize: "13px",
    fontWeight: 800,
  },
};
