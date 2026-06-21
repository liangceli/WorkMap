"use client";

import { useMemo, useState } from "react";
import type { ContactTarget, PlayerState, UserPresenceStatus } from "@workmap/shared-types";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import type { OfficePanelKey } from "./OfficeLeftRail";
import { OfficeIcon } from "./OfficeIcons";
import type { RemoteOfficePlayer } from "./mockOfficeData";
import { labelStatus, presenceFreshnessLabel, statusColors } from "./presence";

type OfficeSidePanelProps = {
  activePanel: OfficePanelKey | null;
  people: RemoteOfficePlayer[];
  currentUser: PlayerState;
  presenceSource: "mock" | "api" | "partial-api";
  destinations: OfficeDestination[];
  onClose: () => void;
  onSelectPerson: (target: ContactTarget) => void;
  onGoToPerson: (player: RemoteOfficePlayer) => void;
  onWaveToPerson: (target: ContactTarget) => void;
  onOpenTeams: (target: ContactTarget) => void;
  onOpenEmail: (target: ContactTarget) => void;
  onGoToDestination: (destination: OfficeDestination) => void;
  onOpenPanel: (panel: OfficePanelKey) => void;
  toast: (message: string) => void;
};

type StatusFilter = "all" | "available" | "focus" | "busy" | "idle" | "offline";

export function OfficeSidePanel({
  activePanel,
  people,
  currentUser,
  presenceSource,
  destinations,
  onClose,
  onSelectPerson,
  onGoToPerson,
  onWaveToPerson,
  onOpenTeams,
  onOpenEmail,
  onGoToDestination,
  onOpenPanel,
  toast,
}: OfficeSidePanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [chatTarget, setChatTarget] = useState("general");
  const [messages, setMessages] = useState<Array<{ channel: string; text: string }>>([]);
  const [messageText, setMessageText] = useState("");
  const meetings: Array<{ title: string; time: string; room: string; attendees: string }> = [];
  const presenceSummary = useMemo(() => summarizePresence(people), [people]);
  const roomNameById = useMemo(() => createRoomNameMap(destinations), [destinations]);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return people.filter((person) => {
      const roomName = friendlyRoom(person.roomId, roomNameById);
      const matchesQuery = `${person.displayName} ${person.role} ${roomName}`.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" || person.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [people, query, roomNameById, statusFilter]);

  if (!activePanel || activePanel === "search") {
    return null;
  }

  const sendMessage = () => {
    const text = messageText.trim();
    if (!text) {
      return;
    }
    setMessages((current) => [...current, { channel: chatTarget, text }]);
    setMessageText("");
  };

  return (
    <aside className="wm-office-side-panel" style={styles.panel}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>{panelTitle(activePanel)}</h2>
          <p style={styles.subtitle}>{panelSubtitle(activePanel)}</p>
        </div>
        <button type="button" aria-label="Close panel" onClick={onClose} style={styles.closeButton}>
          <OfficeIcon name="close" size={18} />
        </button>
      </header>

      <div style={styles.panelBody}>
        {activePanel === "people" ? (
          <section style={styles.stack}>
            <article style={styles.selfCard}>
              <span style={styles.avatar}>Y</span>
              <span style={styles.personText}>
                <strong>You</strong>
                <span>Local controls stay with you</span>
                <span>{friendlyRoom(currentUser.roomId, roomNameById)}</span>
              </span>
              <span style={styles.statusWrap}>
                <span style={{ ...styles.statusDot, background: statusColors[currentUser.status] }} />
                {labelStatus(currentUser.status)}
              </span>
            </article>

            <div style={styles.summaryGrid} aria-label="Team presence summary">
              <span style={styles.summaryItem}>
                <strong>{presenceSummary.active}</strong>
                active
              </span>
              <span style={styles.summaryItem}>
                <strong>{presenceSummary.idle}</strong>
                idle
              </span>
              <span style={styles.summaryItem}>
                <strong>{presenceSummary.offline}</strong>
                offline
              </span>
            </div>

            <p style={styles.presenceNote}>{presenceNote(presenceSource, people.length)}</p>
            <section style={styles.privacyBoundary}>
              <strong>Presence is visible in the office</strong>
              <span>Teammates can see avatar location, workspace status, and last-seen freshness.</span>
              <span>No screen recording, keystroke logging, hidden webcam, microphone, or message content is shown here.</span>
            </section>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team..." style={styles.input} />
            <div style={styles.filterRow}>
              {(["all", "available", "focus", "busy", "idle", "offline"] as StatusFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  style={{ ...styles.filterButton, ...(statusFilter === filter ? styles.filterButtonActive : {}) }}
                >
                  {filter === "all" ? "All" : labelStatus(filter as UserPresenceStatus)}
                </button>
              ))}
            </div>
            <div style={styles.personList}>
              {filteredPeople.length > 0 ? (
                filteredPeople.map((person) => {
                  const freshness = presenceFreshnessLabel(person.updatedAt, person.status);
                  const contactTarget = toContactTarget(person);
                  return (
                    <article key={person.userId} style={styles.personCard}>
                      <button type="button" onClick={() => onSelectPerson(contactTarget)} style={styles.personMain}>
                        <span style={styles.avatar}>{person.displayName.slice(0, 1)}</span>
                        <span style={styles.personText}>
                          <strong>{person.displayName}</strong>
                          <span>{person.role}</span>
                          <span>{friendlyRoom(person.roomId, roomNameById)}</span>
                        </span>
                        <span style={styles.statusColumn}>
                          <span style={styles.statusWrap}>
                            <span style={{ ...styles.statusDot, background: statusColors[person.status] }} />
                            {freshness.label}
                          </span>
                          <span style={styles.lastSeen}>{freshness.detail}</span>
                        </span>
                      </button>
                      <div style={styles.actionGrid}>
                        <button type="button" onClick={() => onSelectPerson(contactTarget)} style={styles.smallButton}>Details</button>
                        <button type="button" onClick={() => onWaveToPerson(contactTarget)} style={styles.smallButton}>Wave</button>
                        <button type="button" onClick={() => onGoToPerson(person)} style={styles.smallButton}>Go to</button>
                        <button type="button" onClick={() => onOpenTeams(contactTarget)} style={styles.smallButton}>Teams</button>
                        <button type="button" onClick={() => onOpenEmail(contactTarget)} style={styles.smallButton}>Email</button>
                        <button type="button" onClick={() => toast("3CX calling is coming later and is disabled in this alpha.")} style={styles.smallButton}>3CX</button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <article style={styles.emptyState}>
                  <strong>{people.length === 0 ? "No teammates visible yet" : "No matching teammates"}</strong>
                  <span>
                    {people.length === 0
                      ? "Your own position is still local. Remote teammates will appear here when the API has safe presence data."
                      : "Try a different name or presence filter."}
                  </span>
                </article>
              )}
            </div>
          </section>
        ) : null}

        {activePanel === "rooms" ? (
          <section style={styles.stack}>
            {destinations.map((destination) => (
              <article key={destination.id} style={styles.roomCard}>
                <span style={styles.roomBadge}>{destination.type.replace("_", " ")}</span>
                <h3 style={styles.cardTitle}>{destination.name}</h3>
                <p style={styles.cardText}>{destination.description ?? "WorkMap office area."}</p>
                <div style={styles.twoActions}>
                  <button type="button" onClick={() => onGoToDestination(destination)} style={styles.primaryButton}>Go to room</button>
                  <button type="button" onClick={() => onOpenPanel("people")} style={styles.secondaryButton}>View people</button>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {activePanel === "chat" ? (
          <section style={styles.stack}>
            <p style={styles.note}>WorkMap quick messages are frontend-only notes in this MVP. They do not sync to teammates or read Teams or Outlook content.</p>
            <select value={chatTarget} onChange={(event) => setChatTarget(event.target.value)} style={styles.input}>
              <option value="general"># general</option>
              <option value="announcements"># announcements</option>
              <option value="support"># support</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>DM: {person.displayName}</option>
              ))}
            </select>
            <div style={styles.messageList}>
              {messages.filter((message) => message.channel === chatTarget).length > 0 ? (
                messages.filter((message) => message.channel === chatTarget).map((message, index) => (
                  <p key={`${message.channel}-${index}`} style={styles.message}>{message.text}</p>
                ))
              ) : (
                <p style={styles.emptyText}>No messages in this local channel.</p>
              )}
            </div>
            <div style={styles.composer}>
              <input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Add local note" style={styles.input} />
              <button type="button" onClick={sendMessage} style={styles.primaryButton}>Add note</button>
            </div>
          </section>
        ) : null}

        {activePanel === "calendar" ? (
          <section style={styles.stack}>
            <p style={styles.note}>Calendar is a schedule launcher in this MVP. WorkMap does not sync calendar content yet.</p>
            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => toast("Calendar scheduling requires a connected calendar integration.")}
            >
              Schedule meeting
            </button>
            {meetings.length === 0 ? <p style={styles.emptyText}>No calendar items are connected yet.</p> : meetings.map((meeting) => (
              <article key={`${meeting.title}-${meeting.time}`} style={styles.roomCard}>
                <h3 style={styles.cardTitle}>{meeting.title}</h3>
                <p style={styles.cardText}>{meeting.time} / {meeting.room}</p>
                <p style={styles.cardText}>{meeting.attendees}</p>
                <div style={styles.twoActions}>
                  <button type="button" onClick={() => toast("Teams launcher is not connected yet.")} style={styles.smallButton}>Open Teams</button>
                  <button
                    type="button"
                    onClick={() => {
                      const destination = destinations.find((item) => item.name === meeting.room);
                      if (destination) onGoToDestination(destination);
                    }}
                    style={styles.smallButton}
                  >
                    Go to room
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {activePanel === "notices" ? (
          <section style={styles.stack}>
            <p style={styles.emptyText}>No workspace notices yet.</p>
          </section>
        ) : null}

        {activePanel === "settings" ? (
          <section style={styles.stack}>
            <p style={styles.note}>Office preferences and shortcuts only. Admin settings stay outside the map.</p>
            <a href="/settings" style={styles.linkButton}>Open settings</a>
            <a href="/onboarding/avatar" style={styles.linkButton}>Edit avatar</a>
            <a href="/compliance" style={styles.linkButton}>Review privacy policy</a>
            <button type="button" onClick={() => onOpenPanel("people")} style={styles.primaryButton}>Back to people</button>
          </section>
        ) : null}
      </div>
    </aside>
  );
}

function toContactTarget(person: RemoteOfficePlayer): ContactTarget {
  return {
    userId: person.userId,
    displayName: person.displayName,
    role: person.role,
    status: person.status,
  };
}

function panelTitle(panel: OfficePanelKey) {
  const titles: Record<OfficePanelKey, string> = {
    search: "Search",
    rooms: "Rooms",
    people: "People",
    chat: "Chat",
    calendar: "Calendar",
    notices: "Notices",
    settings: "Preferences",
  };

  return titles[panel];
}

function panelSubtitle(panel: OfficePanelKey) {
  const subtitles: Record<OfficePanelKey, string> = {
    search: "Find people, rooms, or actions",
    rooms: "Go to office areas",
    people: "Find teammates",
    chat: "Frontend-only quick messages",
    calendar: "Schedule and room launchers",
    notices: "Calm workspace updates",
    settings: "Office preferences",
  };

  return subtitles[panel];
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

function summarizePresence(people: RemoteOfficePlayer[]) {
  return people.reduce(
    (summary, person) => {
      if (person.status === "offline") {
        summary.offline += 1;
      } else if (person.status === "idle" || person.status === "break") {
        summary.idle += 1;
      } else {
        summary.active += 1;
      }

      return summary;
    },
    { active: 0, idle: 0, offline: 0 },
  );
}

function presenceNote(source: OfficeSidePanelProps["presenceSource"], peopleCount: number) {
  if (source === "mock") {
    return "Workspace presence is unavailable until Cognito auth and backend office data are connected.";
  }

  if (peopleCount === 0) {
    return "Backend presence is connected. No other teammates are visible yet.";
  }

  return "Backend presence is connected. Teammates refresh automatically.";
}

const styles = {
  panel: {
    ...wmStyles.elevatedCard,
    position: "absolute" as const,
    top: "122px",
    left: "112px",
    bottom: "150px",
    zIndex: 34,
    width: "368px",
    overflow: "hidden",
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr)",
    background: "rgba(255, 253, 248, 0.9)",
    color: wm.colors.text,
    backdropFilter: "blur(18px)",
    padding: 0,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
    padding: "24px 24px 20px",
  },
  panelBody: {
    minHeight: 0,
    overflowY: "auto" as const,
    padding: "0 24px 24px",
    scrollbarGutter: "stable" as const,
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "20px",
    fontWeight: 800,
  },
  subtitle: {
    margin: "6px 0 0",
    color: wm.colors.secondary,
    fontSize: "14px",
    fontWeight: 700,
  },
  closeButton: {
    display: "grid",
    placeItems: "center",
    width: "32px",
    height: "32px",
    border: 0,
    borderRadius: wm.radius.md,
    background: "transparent",
    color: wm.colors.textSecondary,
    cursor: "pointer",
    fontWeight: 700,
  },
  stack: {
    display: "grid",
    gap: "14px",
  },
  selfCard: {
    display: "grid",
    gridTemplateColumns: "46px minmax(0, 1fr) auto",
    gap: "12px",
    alignItems: "center",
    border: `1px solid ${wm.colors.primaryContainer}`,
    borderRadius: "18px",
    background: "rgba(31, 122, 120, 0.08)",
    padding: "12px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  summaryItem: {
    display: "grid",
    gap: "2px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "14px",
    background: "rgba(255, 253, 248, 0.76)",
    color: wm.colors.textMuted,
    padding: "10px",
    fontSize: "11px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
  },
  presenceNote: {
    margin: 0,
    border: `1px solid ${wm.colors.surfaceHigh}`,
    borderRadius: "14px",
    background: "rgba(244, 248, 244, 0.82)",
    color: wm.colors.textSecondary,
    padding: "11px 12px",
    fontSize: "12px",
    lineHeight: 1.35,
    fontWeight: 800,
  },
  privacyBoundary: {
    display: "grid",
    gap: "5px",
    border: `1px solid ${wm.colors.complianceBorder}`,
    borderRadius: "14px",
    background: wm.colors.complianceBg,
    color: wm.colors.textSecondary,
    padding: "12px",
    fontSize: "12px",
    lineHeight: 1.35,
    fontWeight: 750,
  },
  input: {
    ...wmStyles.input,
    minHeight: "46px",
    borderRadius: "14px",
    padding: "0 14px",
    background: "rgba(255, 253, 248, 0.82)",
    fontWeight: 700,
  },
  filterRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  filterButton: {
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: wm.colors.border,
    borderRadius: "999px",
    background: "rgba(255, 253, 248, 0.72)",
    color: wm.colors.textSecondary,
    padding: "9px 13px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },
  filterButtonActive: {
    borderColor: wm.colors.secondary,
    background: wm.colors.secondary,
    color: wm.colors.surface,
  },
  personList: {
    display: "grid",
    gap: "14px",
  },
  personCard: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "18px",
    background: "rgba(255, 253, 248, 0.82)",
    padding: "12px",
    boxShadow: wm.shadow.card,
  },
  personMain: {
    display: "grid",
    gridTemplateColumns: "46px minmax(0, 1fr) auto",
    gap: "12px",
    alignItems: "center",
    width: "100%",
    border: 0,
    background: "transparent",
    color: wm.colors.text,
    cursor: "pointer",
    textAlign: "left" as const,
    padding: 0,
  },
  avatar: {
    display: "grid",
    placeItems: "center",
    width: "46px",
    height: "46px",
    borderRadius: "999px",
    background: wm.colors.surfaceContainer,
    color: wm.colors.primary,
    fontWeight: 700,
  },
  personText: {
    display: "grid",
    gap: "3px",
    color: wm.colors.textMuted,
    fontSize: "12px",
    minWidth: 0,
  },
  statusWrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: wm.colors.textSecondary,
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "capitalize" as const,
  },
  statusColumn: {
    display: "grid",
    justifyItems: "end",
    gap: "3px",
    minWidth: "92px",
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
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginTop: "12px",
  },
  emptyState: {
    display: "grid",
    gap: "6px",
    border: `1px dashed ${wm.colors.border}`,
    borderRadius: "18px",
    background: "rgba(255, 253, 248, 0.64)",
    color: wm.colors.textMuted,
    padding: "16px",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  smallButton: {
    ...wmStyles.secondaryButton,
    borderRadius: "10px",
    background: "rgba(255, 253, 248, 0.82)",
    padding: "8px",
    fontSize: "11px",
  },
  note: {
    margin: 0,
    border: `1px solid ${wm.colors.surfaceHigh}`,
    borderRadius: "14px",
    background: "rgba(31, 122, 120, 0.08)",
    color: wm.colors.primary,
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 700,
  },
  messageList: {
    minHeight: "220px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "16px",
    background: "rgba(244, 248, 244, 0.82)",
    padding: "10px",
  },
  message: {
    margin: "0 0 8px",
    borderRadius: "12px",
    background: wm.colors.surface,
    padding: "10px",
    color: wm.colors.textSecondary,
    fontSize: "13px",
  },
  emptyText: {
    margin: 0,
    border: `1px dashed ${wm.colors.border}`,
    borderRadius: "14px",
    background: "rgba(255, 253, 248, 0.64)",
    color: wm.colors.textMuted,
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 750,
  },
  composer: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    borderColor: wm.colors.secondary,
    borderRadius: "14px",
    background: wm.colors.secondary,
    padding: "11px 12px",
  },
  secondaryButton: {
    ...wmStyles.secondaryButton,
    borderRadius: "14px",
    padding: "11px 12px",
  },
  roomCard: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "18px",
    background: "rgba(255, 253, 248, 0.82)",
    padding: "14px",
  },
  roomBadge: {
    display: "inline-flex",
    marginBottom: "10px",
    border: `1px solid ${wm.colors.surfaceHigh}`,
    borderRadius: "999px",
    background: "rgba(31, 122, 120, 0.1)",
    color: wm.colors.secondary,
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
  },
  cardTitle: {
    margin: "0 0 6px",
    color: wm.colors.text,
    fontSize: "16px",
    fontWeight: 700,
  },
  cardText: {
    margin: "0 0 5px",
    color: wm.colors.textMuted,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  twoActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "12px",
  },
  noticeRow: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "16px",
    background: "rgba(255, 253, 248, 0.82)",
    color: wm.colors.text,
    padding: "12px",
    cursor: "pointer",
    textAlign: "left" as const,
    fontWeight: 700,
  },
  linkButton: {
    ...wmStyles.secondaryButton,
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.82)",
    padding: "12px",
    textAlign: "center" as const,
  },
};
