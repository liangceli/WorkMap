"use client";

import { useMemo, useState } from "react";
import type { ContactTarget } from "@workmap/shared-types";
import type { OfficeDestination } from "../../lib/office/officeNavigationConfig";
import type { OfficePanelKey } from "./OfficeLeftRail";
import type { RemoteOfficePlayer } from "./mockOfficeData";
import { PresenceBadge } from "./PresenceBadge";

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
    return people.filter((person) => `${person.displayName} ${person.role} ${person.roomId ?? ""}`.toLowerCase().includes(normalized));
  }, [people, query]);

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
          <p style={styles.eyebrow}>Office</p>
          <h2 style={styles.title}>{panelTitle(activePanel)}</h2>
        </div>
        <button type="button" aria-label="Close panel" onClick={onClose} style={styles.closeButton}>x</button>
      </header>

      {activePanel === "people" ? (
        <section style={styles.stack}>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" style={styles.input} />
          <div style={styles.filterRow}>
            <span>Online</span>
            <span>Focus</span>
            <span>Busy</span>
            <span>Break</span>
          </div>
          <div style={styles.personList}>
            {filteredPeople.map((person) => (
              <article key={person.userId} style={styles.personCard}>
                <button
                  type="button"
                  onClick={() => onSelectPerson(toContactTarget(person))}
                  style={styles.personMain}
                >
                  <span style={styles.avatar}>{person.displayName.slice(0, 1)}</span>
                  <span style={styles.personText}>
                    <strong>{person.displayName}</strong>
                    <span>{person.role}</span>
                    <span>{person.roomId ?? "Office area"}</span>
                  </span>
                  <PresenceBadge status={person.status} />
                </button>
                <div style={styles.actionGrid}>
                  <button type="button" onClick={() => onSelectPerson(toContactTarget(person))} style={styles.smallButton}>Message</button>
                  <button type="button" onClick={() => toast(`${person.displayName} received an emoji.`)} style={styles.smallButton}>Emoji</button>
                  <button type="button" onClick={() => toast(`You waved to ${person.displayName}.`)} style={styles.smallButton}>Wave</button>
                  <button type="button" onClick={() => onGoToPerson(person)} style={styles.smallButton}>Go to</button>
                  <button type="button" onClick={() => toast("Teams link placeholder opened.")} style={styles.smallButton}>Teams</button>
                  <button type="button" onClick={() => { window.location.href = `mailto:${person.userId}@workmap.local`; }} style={styles.smallButton}>Outlook</button>
                  <button type="button" onClick={() => toast("3CX link placeholder opened.")} style={styles.smallButton}>3CX</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {activePanel === "chat" ? (
        <section style={styles.stack}>
          <p style={styles.note}>WorkMap quick messages are separate from Teams and Outlook in this MVP.</p>
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
            <input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="Write a quick message" style={styles.input} />
            <button type="button" onClick={sendMessage} style={styles.primaryButton}>Send</button>
          </div>
        </section>
      ) : null}

      {activePanel === "calendar" ? (
        <section style={styles.stack}>
          <p style={styles.note}>Calendar integration is link-based in this MVP. WorkMap does not read your calendar or message content.</p>
          <button
            type="button"
            style={styles.primaryButton}
            onClick={() => setMeetings((current) => [...current, { title: "New WorkMap meeting", time: "15:30", room: "Focus Room", attendees: "Selected teammates" }])}
          >
            New meeting
          </button>
          {meetings.map((meeting) => (
            <article key={`${meeting.title}-${meeting.time}`} style={styles.meetingCard}>
              <h3 style={styles.cardTitle}>{meeting.title}</h3>
              <p style={styles.cardText}>{meeting.time} / {meeting.room}</p>
              <p style={styles.cardText}>{meeting.attendees}</p>
              <div style={styles.twoActions}>
                <button type="button" onClick={() => toast("Teams join link placeholder ready.")} style={styles.smallButton}>Join Teams</button>
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
            "Teams link ready",
          ].map((notice) => (
            <button key={notice} type="button" onClick={() => toast(notice)} style={styles.noticeRow}>{notice}</button>
          ))}
        </section>
      ) : null}

      {activePanel === "settings" ? (
        <section style={styles.stack}>
          <a href="/dashboard" style={styles.linkButton}>Dashboard</a>
          <a href="/employees" style={styles.linkButton}>Employees</a>
          <a href="/reports" style={styles.linkButton}>Reports</a>
          <a href="/compliance" style={styles.linkButton}>Compliance</a>
          <a href="/integrations" style={styles.linkButton}>Integrations</a>
          <a href="/settings" style={styles.linkButton}>Settings</a>
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
    people: "People",
    search: "Search",
    chat: "Chat",
    calendar: "Calendar",
    notices: "Notices",
    settings: "Preferences",
  };

  return titles[panel];
}

const styles = {
  panel: {
    position: "absolute" as const,
    top: "96px",
    left: "82px",
    bottom: "24px",
    zIndex: 34,
    width: "360px",
    overflow: "auto",
    border: "1px solid rgba(203, 213, 225, 0.84)",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.92)",
    color: "#0f172a",
    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
    backdropFilter: "blur(18px)",
    padding: "16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "10px",
    alignItems: "center",
    marginBottom: "14px",
  },
  eyebrow: {
    margin: "0 0 5px",
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    fontSize: "24px",
  },
  closeButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#475569",
    cursor: "pointer",
    fontWeight: 900,
  },
  stack: {
    display: "grid",
    gap: "12px",
  },
  input: {
    minHeight: "40px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "0 10px",
    color: "#0f172a",
    background: "#ffffff",
    fontSize: "14px",
  },
  filterRow: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap" as const,
    color: "#475569",
    fontSize: "12px",
    fontWeight: 800,
  },
  personList: {
    display: "grid",
    gap: "10px",
  },
  personCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    background: "#ffffff",
    padding: "10px",
  },
  personMain: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr) auto",
    gap: "10px",
    alignItems: "center",
    width: "100%",
    border: 0,
    background: "transparent",
    color: "#0f172a",
    cursor: "pointer",
    textAlign: "left" as const,
    padding: 0,
  },
  avatar: {
    display: "grid",
    placeItems: "center",
    width: "42px",
    height: "42px",
    borderRadius: "12px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 900,
  },
  personText: {
    display: "grid",
    gap: "2px",
    color: "#64748b",
    fontSize: "12px",
    minWidth: 0,
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    marginTop: "10px",
  },
  smallButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "7px",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "7px",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: 900,
  },
  note: {
    margin: 0,
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "10px",
    fontSize: "13px",
    lineHeight: 1.45,
  },
  messageList: {
    minHeight: "220px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    background: "#f8fafc",
    padding: "10px",
  },
  message: {
    margin: "0 0 8px",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "8px",
    color: "#334155",
    fontSize: "13px",
  },
  composer: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "8px",
  },
  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "10px",
    cursor: "pointer",
    fontWeight: 900,
  },
  meetingCard: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    background: "#ffffff",
    padding: "12px",
  },
  cardTitle: {
    margin: "0 0 6px",
    fontSize: "16px",
  },
  cardText: {
    margin: "0 0 5px",
    color: "#64748b",
    fontSize: "13px",
  },
  twoActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "10px",
  },
  noticeRow: {
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px",
    cursor: "pointer",
    textAlign: "left" as const,
    fontWeight: 800,
  },
  linkButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#0f172a",
    padding: "10px",
    textAlign: "center" as const,
    textDecoration: "none",
    fontWeight: 900,
  },
};
