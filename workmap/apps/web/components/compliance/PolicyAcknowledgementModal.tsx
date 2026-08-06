"use client";

import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type PolicyAcknowledgementModalProps = {
  open: boolean;
  busy?: boolean;
  policyVersion?: string;
  collectOpenRuntime?: boolean;
  collectDomainOpenRuntime?: boolean;
  onClose: () => void;
  onAcknowledge: () => void | Promise<void>;
};

export function PolicyAcknowledgementModal({ open, busy = false, policyVersion, collectOpenRuntime = false, collectDomainOpenRuntime = false, onClose, onAcknowledge }: PolicyAcknowledgementModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div style={styles.backdrop} role="presentation">
      <section aria-modal="true" role="dialog" aria-labelledby="policy-title" style={styles.modal}>
        <div style={styles.header}>
          <div>
            <p style={styles.eyebrow}>CandidGrid visibility policy{policyVersion ? ` / ${policyVersion}` : ""}</p>
            <h2 id="policy-title" style={styles.title}>Acknowledge CandidGrid visibility</h2>
          </div>
          <button type="button" aria-label="Close policy modal" onClick={onClose} disabled={busy} style={styles.closeButton}>
            x
          </button>
        </div>

        <p style={styles.bodyText}>
          CandidGrid may collect presence, avatar location, workspace status, desktop app name and usage duration, browser domain and
          usage duration, device heartbeat, freshness, and last-seen context so workspace activity summaries stay transparent.
          {collectOpenRuntime ? " The current policy also measures how long an App has a user-visible Windows window open; this is separate from Focus active time." : ""}
          {collectDomainOpenRuntime ? " It also measures how long at least one eligible browser tab for a hostname remains open; this is separate from Domain Focus and may overlap across different hostnames." : ""}
          CandidGrid messages, waves, reactions, and Notice read state are stored when users intentionally send them. It does not
          collect screenshots, screen recordings, keystrokes, clipboard data, webcam or microphone data, external private
          message, Teams, or email body content, webpage body content, form inputs, or passwords.
        </p>

        <div style={styles.grid}>
          <div style={styles.panel}>
            <h3 style={styles.smallTitle}>Collected</h3>
            <ul style={styles.list}>
              <li>Desktop app name</li>
              <li>Browser domain name</li>
              <li>Usage duration and timestamps for summaries</li>
              {collectOpenRuntime ? <li>App open/runtime for user-visible Windows windows</li> : null}
              {collectDomainOpenRuntime ? <li>Browser Domain open/runtime, de-duplicated per hostname</li> : null}
              <li>Device heartbeat status</li>
              <li>Avatar room or office area</li>
              <li>Workspace status and freshness</li>
              <li>Last-seen timestamp</li>
              <li>Policy acknowledgement time</li>
              <li>CandidGrid messages, waves, reactions, and Notice read state</li>
            </ul>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.smallTitle}>Not collected</h3>
            <ul style={styles.list}>
              <li>Screenshots or screen recordings</li>
              <li>Keystrokes</li>
              <li>Clipboard contents</li>
              <li>Webcam or microphone data</li>
              <li>External private message, Teams, or email body content</li>
              <li>Webpage body content, form inputs, or passwords</li>
              <li>Full URL paths, query strings, or fragments</li>
            </ul>
          </div>
        </div>

        <div style={styles.actions}>
          <button type="button" onClick={onClose} disabled={busy} style={styles.secondaryButton}>
            Review later
          </button>
          <button type="button" onClick={onAcknowledge} disabled={busy} style={styles.primaryButton}>
            {busy ? "Recording..." : "Acknowledge policy"}
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
    background: "rgba(16, 32, 51, 0.38)",
    padding: "20px",
  },
  modal: {
    ...wmStyles.elevatedCard,
    width: "min(760px, 100%)",
    boxShadow: wm.shadow.overlay,
    padding: "18px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    flexWrap: "wrap" as const,
    marginBottom: "12px",
  },
  eyebrow: {
    ...wmStyles.eyebrow,
  },
  title: {
    margin: 0,
    color: wm.colors.text,
    fontSize: "24px",
    fontWeight: 700,
  },
  closeButton: {
    width: "32px",
    height: "32px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: wm.colors.surface,
    color: wm.colors.text,
    cursor: "pointer",
    fontWeight: 700,
  },
  bodyText: {
    margin: "0 0 14px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "12px",
  },
  panel: {
    border: `1px solid ${wm.colors.borderSubtle}`,
    borderRadius: wm.radius.lg,
    background: wm.colors.surfaceLow,
    padding: "14px",
  },
  smallTitle: {
    margin: "0 0 8px",
    color: wm.colors.text,
    fontSize: "16px",
    fontWeight: 700,
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.7,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    flexWrap: "wrap" as const,
    marginTop: "16px",
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    padding: "10px 14px",
  },
  secondaryButton: {
    ...wmStyles.secondaryButton,
    padding: "10px 14px",
  },
};
