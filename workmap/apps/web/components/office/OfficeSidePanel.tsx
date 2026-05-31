"use client";

import { useMemo, useState } from "react";
import type { ContactTarget, UserPresenceStatus } from "@workmap/shared-types";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import type { OfficePanelKey } from "./OfficeLeftRail";
import type { RemoteOfficePlayer } from "./mockOfficeData";
import { labelStatus, statusColors } from "./presence";

type OfficeSidePanelProps = {
  activePanel: OfficePanelKey | null;
  people: RemoteOfficePlayer[];
  destinations: OfficeDestination[];
  onClose: () => void;
  onSelectPerson: (target: ContactTarget) => void;
  onGoToPerson: (player: RemoteOfficePlayer) => void;
  onGoToDestination: (destination: OfficeDestination) => void;
  onOpenPanel: (panel: OfficePanelKey) => void;
  toast: (message: string) => void;
};

type StatusFilter = "all" | "available" | "focus" | "busy" | "break";

export function OfficeSidePanel({
  activePanel,
  people,
  destinations,
  onClose,
  onSelectPerson,
  onGoToPerson,
  onGoToDestination,
  onOpenPanel,
  toast,
}: OfficeSidePanelProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [chatTarget, setChatTarget] = useState("general");
  const [messages, setMessages] = useState([
    { channel: "general", text: "Welcome to WorkMap quick messages." },
    { channel: "announcements", text: "Policy acknowledgement completed." },
  ]);
  const [messageText, setMessageText] = useState("");
  const [meetings, setMeetings] = useState([
    { title: "Product sync", time: "10:30", room: "Main Meeting Room", attendees: "Mia, Ethan, Sofia" },
    { title: "Support handoff", time: "14:00", room: "IT Support", attendees: "Ava, Ethan" },
  ]);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return people.filter((person) => {
      const matchesQuery = `${person.displayName} ${person.role} ${person.roomId ?? ""}`.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" || person.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [people, query, statusFilter]);

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
    <aside style={styles.panel}>
      <header style={styles.header}>
        <div>
          <h2 style={styles.title}>{panelTitle(activePanel)}</h2>
          <p style={styles.subtitle}>{panelSubtitle(activePanel)}</p>
        </div>
        <button type="button" aria-label="Close panel" onClick={onClose} style={styles.closeButton}>x</button>
      </header>

      {activePanel === "people" ? (
        <section style={styles.stack}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search team..." style={styles.input} />
          <div style={styles.filterRow}>
            {(["all", "available", "focus", "busy", "break"] as StatusFilter[]).map((filter) => (
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
            {filteredPeople.map((person) => (
              <article key={person.userId} style={styles.personCard}>
                <button type="button" onClick={() => onSelectPerson(toContactTarget(person))} style={styles.personMain}>
                  <span style={styles.avatar}>{person.displayName.slice(0, 1)}</span>
                  <span style={styles.personText}>
                    <strong>{person.displayName}</strong>
                    <span>{person.role}</span>
                    <span>{friendlyRoom(person.roomId)}</span>
                  </span>
                  <span style={styles.statusWrap}>
                    <span style={{ ...styles.statusDot, background: statusColors[person.status] }} />
                    {labelStatus(person.status)}
                  </span>
                </button>
                <div style={styles.actionGrid}>
                  <button type="button" onClick={() => onSelectPerson(toContactTarget(person))} style={styles.smallButton}>Message</button>
                  <button type="button" onClick={() => toast(`You waved to ${person.displayName}.`)} style={styles.smallButton}>Wave</button>
                  <button type="button" onClick={() => onGoToPerson(person)} style={styles.smallButton}>Go to</button>
                  <button type="button" onClick={() => toast("Teams launcher placeholder.")} style={styles.smallButton}>Teams</button>
                  <button type="button" onClick={() => { window.location.href = `mailto:${person.userId}@workmap.local`; }} style={styles.smallButton}>Outlook</button>
                  <button type="button" onClick={() => toast("3CX launcher placeholder.")} style={styles.smallButton}>3CX</button>
                </div>
              </article>
            ))}
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
          <p style={styles.note}>WorkMap quick messages are frontend-only in this MVP. They do not read Teams or Outlook content.</p>
          <select value={chatTarget} onChange={(event) => setChatTarget(event.target.value)} style={styles.input}>
            <option value="general"># general</option>
            <option value="announcements"># announcements</option>
            <option value="support"># support</option>
            {people.map((person) => (
              <option key={person.userId} value={person.userId}>DM: {person.displayName}</option>
            ))}
          </select>
          <div style={styles.messageList}>
            {messages.filter((message) => message.channel === chatTarget).map((message, index) => (
              <p key={`${message.channel}-${index}`} style={styles.message}>{message.text}</p>
            ))}
          </div>
          <div style={styles.composer}>
            <input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Send quiet message" style={styles.input} />
            <button type="button" onClick={sendMessage} style={styles.primaryButton}>Send</button>
          </div>
        </section>
      ) : null}

      {activePanel === "calendar" ? (
        <section style={styles.stack}>
          <p style={styles.note}>Calendar is a schedule launcher in this MVP. WorkMap does not sync calendar content yet.</p>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => setMeetings((current) => [...current, { title: "New WorkMap meeting", time: "15:30", room: "Focus Room", attendees: "Selected teammates" }])}
          >
            Schedule meeting
          </button>
          {meetings.map((meeting) => (
            <article key={`${meeting.title}-${meeting.time}`} style={styles.roomCard}>
              <h3 style={styles.cardTitle}>{meeting.title}</h3>
              <p style={styles.cardText}>{meeting.time} / {meeting.room}</p>
              <p style={styles.cardText}>{meeting.attendees}</p>
              <div style={styles.twoActions}>
                <button type="button" onClick={() => toast("Teams launcher placeholder.")} style={styles.smallButton}>Open Teams</button>
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
          {[
            "Mia waved at you",
            "Sofia is available",
            "Your desk is ready",
            "Policy acknowledgement completed",
            "Desktop Agent setup pending",
            "Meeting starts in 10 minutes",
            "Teams launcher ready",
          ].map((notice) => (
            <button key={notice} type="button" onClick={() => toast(notice)} style={styles.noticeRow}>{notice}</button>
          ))}
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

function friendlyRoom(roomId?: string) {
  return roomId?.replaceAll("-", " ") ?? "Office area";
}

const styles = {
  panel: {
    ...wmStyles.elevatedCard,
    position: "absolute" as const,
    top: "122px",
    left: "112px",
    bottom: "150px",
    zIndex: 34,
    width: "360px",
    overflow: "auto",
    background: "rgba(255, 255, 255, 0.78)",
    color: wm.colors.text,
    backdropFilter: "blur(24px)",
    padding: "24px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "20px",
    fontWeight: 700,
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
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: "rgba(255, 255, 255, 0.82)",
    color: wm.colors.textSecondary,
    cursor: "pointer",
    fontWeight: 700,
  },
  stack: {
    display: "grid",
    gap: "14px",
  },
  input: {
    ...wmStyles.input,
    minHeight: "46px",
    borderRadius: "14px",
    padding: "0 14px",
    background: "rgba(255, 255, 255, 0.82)",
    fontWeight: 700,
  },
  filterRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap" as const,
  },
  filterButton: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.72)",
    color: wm.colors.textSecondary,
    padding: "9px 13px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },
  filterButtonActive: {
    borderColor: wm.colors.primaryContainer,
    background: wm.colors.primaryContainer,
    color: wm.colors.surface,
  },
  personList: {
    display: "grid",
    gap: "14px",
  },
  personCard: {
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.78)",
    padding: "12px",
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.06)",
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
    color: wm.colors.primaryContainer,
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
  smallButton: {
    ...wmStyles.secondaryButton,
    borderRadius: "10px",
    background: "rgba(255, 255, 255, 0.82)",
    padding: "8px",
    fontSize: "11px",
  },
  note: {
    margin: 0,
    border: `1px solid ${wm.colors.surfaceHigh}`,
    borderRadius: "14px",
    background: "rgba(219, 225, 255, 0.72)",
    color: wm.colors.primaryContainer,
    padding: "12px",
    fontSize: "13px",
    lineHeight: 1.45,
    fontWeight: 700,
  },
  messageList: {
    minHeight: "220px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: "16px",
    background: "rgba(248, 249, 255, 0.78)",
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
  composer: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    borderColor: wm.colors.primaryContainer,
    borderRadius: "14px",
    background: wm.colors.primaryContainer,
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
    background: "rgba(255, 255, 255, 0.78)",
    padding: "14px",
  },
  roomBadge: {
    display: "inline-flex",
    marginBottom: "10px",
    border: `1px solid ${wm.colors.surfaceHigh}`,
    borderRadius: "999px",
    background: "rgba(219, 225, 255, 0.74)",
    color: wm.colors.primaryContainer,
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
    background: "rgba(255, 255, 255, 0.82)",
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
