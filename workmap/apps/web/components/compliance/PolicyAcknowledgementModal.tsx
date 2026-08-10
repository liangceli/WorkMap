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
            <p style={styles.eyebrow}>CandidGrid employee monitoring notice{policyVersion ? ` / ${policyVersion}` : ""}</p>
            <h2 id="policy-title" style={styles.title}>Review the employee monitoring notice</h2>
          </div>
          <button type="button" aria-label="Close policy modal" onClick={onClose} disabled={busy} style={styles.closeButton}>
            x
          </button>
        </div>

        <p style={styles.bodyText}>
          This notice explains the technical data CandidGrid collects under the current workspace policy. It does not replace your
          organisation&apos;s workplace monitoring or privacy notice. Confirming below records that you received and read this version;
          it is not consent to monitoring, a waiver of rights, or confirmation that your organisation has met its legal obligations.
          When enabled by the current policy, CandidGrid records Focus active or focused idle time for the foreground App and focused HTTP/HTTPS hostname.
          {collectOpenRuntime ? " The current policy also measures App open/runtime for user-visible Windows windows, including covered or minimised windows; this is separate from Focus active time and is not work time." : ""}
          {collectDomainOpenRuntime ? " It also measures Browser Domain open/runtime while at least one eligible tab for a hostname remains open; same-host tabs are de-duplicated, different hostnames may overlap, and this is not Focus or work time." : ""}
          Presence and content that a user intentionally sends inside CandidGrid are stored separately from automatic device monitoring.
        </p>

        <div style={styles.grid}>
          <div style={styles.panel}>
            <h3 style={styles.smallTitle}>Collected</h3>
            <ul style={styles.list}>
              <li>Foreground App name and Focus active/focused idle duration</li>
              <li>Focused HTTP/HTTPS hostname and Focus active/focused idle duration</li>
              {collectOpenRuntime ? <li>App open/runtime for user-visible Windows windows, including covered or minimised windows</li> : null}
              {collectDomainOpenRuntime ? <li>Browser Domain open/runtime, de-duplicated per hostname</li> : null}
              <li>Device or browser identity, client version, time zone, heartbeat, connection and interruption events</li>
              <li>Virtual-office presence, avatar room or area, workspace status, freshness and last-seen time</li>
              <li>Notice version and confirmation timestamp</li>
              <li>Messages, waves, reactions and Notice read state when a user intentionally sends or interacts with them</li>
            </ul>
          </div>
          <div style={styles.panel}>
            <h3 style={styles.smallTitle}>Not collected</h3>
            <ul style={styles.list}>
              <li>Screenshots or screen recordings</li>
              <li>Key values, typed text, pointer coordinates, scroll direction or target elements</li>
              <li>Clipboard contents</li>
              <li>Webcam or microphone data</li>
              <li>External private message, Teams, or email body content</li>
              <li>Webpage body, form inputs or passwords</li>
              <li>Window or page titles, files, full URL paths, query strings or fragments</li>
            </ul>
          </div>
        </div>

        <div style={styles.actions}>
          <button type="button" onClick={onClose} disabled={busy} style={styles.secondaryButton}>
            Read later
          </button>
          <button type="button" onClick={onAcknowledge} disabled={busy} style={styles.primaryButton}>
            {busy ? "Recording confirmation..." : "Confirm I have read this notice"}
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
