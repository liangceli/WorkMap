"use client";

import { useEffect, useState } from "react";
import { PolicyAcknowledgementModal } from "./PolicyAcknowledgementModal";
import {
  acknowledgeCompliancePolicy,
  confirmCompliancePolicyScheduleTimeZone,
  enableComplianceDomainOpenRuntime,
  enableComplianceOpenRuntime,
  getCompliancePolicy,
  updateCompliancePolicyWorkHours,
} from "../../lib/api/complianceApi";
import { getWorkMapApiAuthOptions, type WorkMapApiAuthResult } from "../../lib/api/apiAuth";
import type { WorkMapApiCompliancePolicy } from "../../lib/api/apiTypes";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

const visibleItems = [
  "Foreground App name and Focus active/focused idle duration",
  "Focused HTTP/HTTPS hostname and Focus active/focused idle duration",
  "Policy-enabled App open/runtime for user-visible Windows windows, including covered or minimised windows",
  "Policy-enabled Browser Domain open/runtime, de-duplicated per hostname",
  "Device or browser identity, client version, time zone, heartbeat, connection and interruption events",
  "Virtual-office presence, avatar room or area, workspace status, freshness and last-seen time",
  "Employee monitoring notice version and confirmation timestamp",
  "Messages, waves, reactions and Notice read state when a user intentionally sends or interacts with them",
];

const notVisibleItems = [
  "Screenshots are not collected",
  "Screen recordings are not collected",
  "Key values, typed text, pointer coordinates, scroll direction and target elements are not collected",
  "Clipboard contents are not collected",
  "Webcam or microphone data is not collected",
  "External private message, Teams, or email body content is not collected",
  "Webpage body, form inputs and passwords are not collected",
  "Window or page titles, files, full URL paths, query strings and fragments are not collected",
];

export function CompliancePolicyPanel() {
  const [modalOpen, setModalOpen] = useState(false);
  const [policy, setPolicy] = useState<WorkMapApiCompliancePolicy | null>(null);
  const [authSource, setAuthSource] = useState<string | null>(null);
  const [acknowledgedAt, setAcknowledgedAt] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Loading policy status...");
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [confirmingTimeZone, setConfirmingTimeZone] = useState(false);
  const [canManageWorkHours, setCanManageWorkHours] = useState(false);
  const [workdayStart, setWorkdayStart] = useState("09:00");
  const [workdayEnd, setWorkdayEnd] = useState("23:00");
  const [savingWorkHours, setSavingWorkHours] = useState(false);
  const [enablingOpenRuntime, setEnablingOpenRuntime] = useState(false);
  const [enablingDomainOpenRuntime, setEnablingDomainOpenRuntime] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPolicy() {
      const auth = await getWorkMapApiAuthOptions();

      if (cancelled) {
        return;
      }

      if (!auth.available) {
        setLoading(false);
        setAuthSource(null);
        setStatusText("Sign in to load the current workspace policy and record that you have read its notice. The general technical notice remains available below.");
        return;
      }

      setAuthSource(auth.source);
      setCanManageWorkHours(auth.role === "OWNER" || auth.role === "HR_ADMIN");
      const policyResult = await getCompliancePolicy(auth.options);

      if (cancelled) {
        return;
      }

      setLoading(false);

      if (!policyResult.ok) {
        setPolicy(null);
        setStatusText("The current workspace policy could not be loaded. The general technical notice is shown, and no confirmation has been recorded.");
        return;
      }

      setPolicy(policyResult.data);
      setWorkdayStart(policyResult.data.workdayStart);
      setWorkdayEnd(policyResult.data.workdayEnd);
      const storedAcknowledgement = readAcknowledgement(auth, policyResult.data.id);
      setAcknowledgedAt(storedAcknowledgement);
      setStatusText(
        storedAcknowledgement
          ? `Receipt and review of notice ${policyResult.data.policyVersion} were confirmed from this browser at ${storedAcknowledgement}.`
          : `Current workspace notice ${policyResult.data.policyVersion} is ready to review.`,
      );
    }

    void loadPolicy();

    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledgePolicy = async () => {
    if (!policy) {
      setStatusText("A current workspace notice must be loaded before a confirmation can be recorded. The general technical notice remains available for review.");
      setModalOpen(false);
      return;
    }

    setAcknowledging(true);
    const auth = await getWorkMapApiAuthOptions();

    if (!auth.available) {
      setAcknowledging(false);
      setStatusText("No signed-in session is available. Sign in before recording that you have read the notice.");
      setModalOpen(false);
      return;
    }

    const result = await acknowledgeCompliancePolicy(policy.id, auth.options);
    setAcknowledging(false);

    if (!result.ok) {
      setStatusText("The confirmation could not be recorded. No browser-only confirmation was saved.");
      setModalOpen(false);
      return;
    }

    const acknowledged = new Date(result.data.acknowledgedAt).toLocaleString();
    setAcknowledgedAt(acknowledged);
    writeAcknowledgement(auth, policy.id, acknowledged);
    setStatusText(`Receipt and review of notice ${policy.policyVersion} confirmed at ${acknowledged}. This is not consent or a waiver of rights.`);
    setModalOpen(false);
  };

  const confirmTimeZone = async () => {
    if (!policy) return;

    const auth = await getWorkMapApiAuthOptions();
    if (!auth.available) {
      setStatusText("Sign in with an authorised policy administrator account before confirming the workspace time zone.");
      return;
    }

    const scheduleTimeZone = getBrowserTimeZone();
    setConfirmingTimeZone(true);
    const result = await confirmCompliancePolicyScheduleTimeZone(
      policy.id,
      scheduleTimeZone,
      auth.options,
    );
    setConfirmingTimeZone(false);

    if (!result.ok) {
      setStatusText(result.error);
      return;
    }

    setPolicy((current) => current
      ? { ...current, scheduleTimeZone: result.data.scheduleTimeZone }
      : current);
    setStatusText(
      `Workspace schedule time zone confirmed as ${result.data.scheduleTimeZone}. Paired tracking clients will retry activation automatically.`,
    );
  };

  const saveWorkHours = async () => {
    if (!policy) return;

    const auth = await getWorkMapApiAuthOptions();
    if (!auth.available) {
      setStatusText("Sign in with an authorised policy administrator account before changing work hours.");
      return;
    }

    setSavingWorkHours(true);
    const result = await updateCompliancePolicyWorkHours(
      policy.id,
      workdayStart,
      workdayEnd,
      auth.options,
    );
    setSavingWorkHours(false);

    if (!result.ok) {
      setStatusText(result.error);
      return;
    }

    setPolicy((current) => current
      ? {
          ...current,
          workdayStart: result.data.workdayStart,
          workdayEnd: result.data.workdayEnd,
        }
      : current);
    setWorkdayStart(result.data.workdayStart);
    setWorkdayEnd(result.data.workdayEnd);
    setStatusText(
      `Collection schedule updated to ${result.data.workdayStart}-${result.data.workdayEnd} ${result.data.scheduleTimeZone ?? "workspace time"}. Paired clients will receive a matching policy lease within five minutes.`,
    );
  };

  const enableOpenRuntime = async () => {
    if (!policy || policy.collectOpenRuntime) return;
    const auth = await getWorkMapApiAuthOptions();
    if (!auth.available) {
      setStatusText("Sign in with an authorised policy administrator account before enabling App open/runtime collection.");
      return;
    }

    setEnablingOpenRuntime(true);
    const result = await enableComplianceOpenRuntime(policy.id, auth.options);
    setEnablingOpenRuntime(false);
    if (!result.ok) {
      setStatusText(result.error);
      return;
    }

    setPolicy(result.data);
    setAcknowledgedAt(null);
    setStatusText(
      `Notice ${result.data.policyVersion} now includes App open/runtime collection. Employees must review and confirm receipt of this version before the Agent receives an authorised runtime lease.`,
    );
  };

  const enableDomainOpenRuntime = async () => {
    if (!policy || policy.collectDomainOpenRuntime) return;
    const auth = await getWorkMapApiAuthOptions();
    if (!auth.available) {
      setStatusText("Sign in with an authorised policy administrator account before enabling Browser Domain open/runtime collection.");
      return;
    }

    setEnablingDomainOpenRuntime(true);
    const result = await enableComplianceDomainOpenRuntime(
      policy.id,
      auth.options,
    );
    setEnablingDomainOpenRuntime(false);
    if (!result.ok) {
      setStatusText(result.error);
      return;
    }

    setPolicy(result.data);
    setAcknowledgedAt(null);
    setStatusText(
      `Notice ${result.data.policyVersion} now includes Browser Domain open/runtime collection. Employees must review and confirm receipt of this version before Browser Extensions receive an authorised runtime lease.`,
    );
  };

  return (
    <div className="wm-compliance-policy" style={styles.stack}>
      <section className="wm-compliance-card-grid" style={styles.policyGrid}>
        <PolicyList title="Recorded or stored by CandidGrid" tone="blue" items={visibleItems} />
        <PolicyList title="Not monitored" tone="green" items={notVisibleItems} />
      </section>

      <section className="wm-compliance-card-grid" style={styles.explanationGrid}>
        <TrustCard
          title="CandidGrid's technical purpose"
          text="CandidGrid uses the stated activity, presence, device-health and notice-confirmation data to produce role-permitted work summaries, show virtual-office presence, operate tracking clients and document current policy coverage. Your organisation must state its own lawful and specific purposes."
        />
        <TrustCard
          title="Who can view reports"
          text="An Employee's report scope is limited to their own activity, where an own-summary surface is available. Team Leads, Managers, HR Admins and Owners can view role-permitted team or employee activity within their organisation. IT Admins cannot view another employee's activity by role. Platform Admin does not receive tenant employee activity views."
        />
        <TrustCard
          title="Your organisation's notice"
          text="This product notice does not replace your organisation's workplace monitoring or privacy notice. Your organisation must provide its identity and contact, purposes, devices and scope, timing and ongoing nature, uses and disclosures, storage and any overseas handling, retention or deletion, consequences, and a privacy or HR contact for access, correction and complaints, as required by applicable law."
        />
      </section>

      <section style={styles.boundaryPanel}>
        <p style={styles.panelLabel}>Role visibility boundary</p>
        <p style={styles.panelText}>
          An Employee&apos;s report scope is limited to their own activity, where an own-summary surface is available. Team Leads, Managers, HR Admins and Owners may view role-permitted team or employee
          activity inside their organisation. IT Admins do not receive another employee&apos;s activity access through their role. Platform Admin
          is limited to privacy-safe tenant metadata, service health and audit information, not tenant employee activity.
        </p>
      </section>

      {policy && !policy.scheduleTimeZone ? (
        <section style={styles.ackPanel}>
          <div>
            <p style={styles.panelLabel}>Workspace schedule setup</p>
            <h2 style={styles.panelTitle}>Confirm the tracking time zone</h2>
            <p style={styles.panelText}>
              Paired Desktop Agents and Browser Extensions wait for an authorised policy administrator to confirm this before tracking starts. The suggested time zone for this browser is {getBrowserTimeZone()}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void confirmTimeZone()}
            disabled={confirmingTimeZone}
            style={styles.primaryButton}
          >
            {confirmingTimeZone ? "Confirming time zone..." : `Confirm ${getBrowserTimeZone()}`}
          </button>
        </section>
      ) : null}

      {policy?.workHoursOnly ? (
        <section style={styles.ackPanel}>
          <div>
            <p style={styles.panelLabel}>Collection schedule</p>
            <h2 style={styles.panelTitle}>
              {policy.workdayStart}-{policy.workdayEnd} {policy.scheduleTimeZone ?? "time zone pending"}
            </h2>
            <p style={styles.panelText}>
              App Focus, Browser Focus and any policy-enabled open/runtime collection run only inside this local workspace window. Device health and secure heartbeats may continue outside it. This control extends an active schedule; narrowing it requires a new policy version so existing leases cannot keep a broader window.
            </p>
          </div>
          {canManageWorkHours ? (
            <div style={styles.scheduleEditor}>
              <label style={styles.timeField}>
                <span>Start</span>
                <input
                  type="time"
                  value={workdayStart}
                  onChange={(event) => setWorkdayStart(event.target.value)}
                  style={styles.timeInput}
                />
              </label>
              <label style={styles.timeField}>
                <span>End</span>
                <input
                  type="time"
                  value={workdayEnd}
                  onChange={(event) => setWorkdayEnd(event.target.value)}
                  style={styles.timeInput}
                />
              </label>
              <button
                type="button"
                onClick={() => void saveWorkHours()}
                disabled={savingWorkHours}
                style={styles.primaryButton}
              >
                {savingWorkHours ? "Saving schedule..." : "Save work hours"}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {policy ? (
        <section style={styles.ackPanel}>
          <div>
            <p style={styles.panelLabel}>App open/runtime</p>
            <h2 style={styles.panelTitle}>
              {policy.collectOpenRuntime ? "Enabled by the current policy" : "Not enabled"}
            </h2>
            <p style={styles.panelText}>
              Open/runtime measures how long an App has at least one user-visible top-level Windows window, including covered or minimized windows. It excludes tray-only/background helper processes and is never added to Focus active time. Different Apps may accumulate runtime at the same time.
            </p>
          </div>
          {canManageWorkHours && !policy.collectOpenRuntime ? (
            <button
              type="button"
              onClick={() => void enableOpenRuntime()}
              disabled={enablingOpenRuntime}
              style={styles.primaryButton}
            >
              {enablingOpenRuntime ? "Creating policy version..." : "Enable and create new policy version"}
            </button>
          ) : null}
        </section>
      ) : null}

      {policy ? (
        <section style={styles.ackPanel}>
          <div>
            <p style={styles.panelLabel}>Browser Domain open/runtime</p>
            <h2 style={styles.panelTitle}>
              {policy.collectDomainOpenRuntime ? "Enabled by the current policy" : "Not enabled"}
            </h2>
            <p style={styles.panelText}>
              Domain open/runtime measures how long at least one eligible HTTP/HTTPS tab for a hostname remains open in Chrome or Edge. Multiple tabs for the same hostname are counted once; different hostnames may accumulate concurrently. It is context only, not Focus or work time, and CandidGrid stores no path, query, page title, or content.
            </p>
          </div>
          {canManageWorkHours && !policy.collectDomainOpenRuntime ? (
            <button
              type="button"
              onClick={() => void enableDomainOpenRuntime()}
              disabled={enablingDomainOpenRuntime}
              style={styles.primaryButton}
            >
              {enablingDomainOpenRuntime ? "Creating policy version..." : "Enable and create new policy version"}
            </button>
          ) : null}
        </section>
      ) : null}

      <section style={styles.ackPanel}>
        <div>
          <p style={styles.panelLabel}>Notice receipt and review</p>
          <h2 style={styles.panelTitle}>{acknowledgedAt ? "Receipt confirmed" : policy ? "Current notice ready" : "General technical notice"}</h2>
          <p style={styles.panelText}>
            {loading
              ? "Checking the current API session..."
              : statusText}
          </p>
          {authSource ? <p style={styles.sessionText}>Signed-in session source: {authSource}</p> : null}
          {policy ? (
            <p style={styles.sessionText}>
              {policy.name} / version {policy.policyVersion} / current policy retention setting {policy.retentionDays} days
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => setModalOpen(true)} style={styles.primaryButton}>
          {policy ? "Review and confirm receipt" : "Review notice"}
        </button>
      </section>

      <PolicyAcknowledgementModal
        open={modalOpen}
        busy={acknowledging}
        policyVersion={policy?.policyVersion}
        collectOpenRuntime={policy?.collectOpenRuntime}
        collectDomainOpenRuntime={policy?.collectDomainOpenRuntime}
        onClose={() => setModalOpen(false)}
        onAcknowledge={acknowledgePolicy}
      />
    </div>
  );
}

function PolicyList({ title, tone, items }: { title: string; tone: "blue" | "green"; items: string[] }) {
  return (
    <section style={styles.policyCard}>
      <div style={{ ...styles.accent, background: tone === "blue" ? wm.colors.secondary : wm.colors.success }} />
      <h2 style={styles.policyTitle}>{title}</h2>
      <ul style={styles.list}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function TrustCard({ title, text }: { title: string; text: string }) {
  return (
    <article style={styles.trustCard}>
      <h2 style={styles.trustTitle}>{title}</h2>
      <p style={styles.trustText}>{text}</p>
    </article>
  );
}

function acknowledgementKey(auth: Extract<WorkMapApiAuthResult, { available: true }>, policyId: string) {
  return `workmap.policyAcknowledgement.${auth.userId}.${policyId}`;
}

function readAcknowledgement(auth: Extract<WorkMapApiAuthResult, { available: true }>, policyId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(acknowledgementKey(auth, policyId));
}

function writeAcknowledgement(auth: Extract<WorkMapApiAuthResult, { available: true }>, policyId: string, acknowledgedAt: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(acknowledgementKey(auth, policyId), acknowledgedAt);
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const styles = {
  stack: {
    display: "grid",
    gap: "14px",
  },
  policyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
    gap: "14px",
  },
  explanationGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
    gap: "14px",
  },
  trustCard: {
    ...wmStyles.card,
    padding: "16px",
  },
  trustTitle: {
    margin: "0 0 8px",
    color: wm.colors.text,
    fontSize: "17px",
    fontWeight: 900,
  },
  trustText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "13px",
    lineHeight: 1.5,
  },
  policyCard: {
    ...wmStyles.card,
    position: "relative" as const,
    overflow: "hidden",
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
    color: wm.colors.text,
    fontSize: "20px",
    fontWeight: 700,
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.8,
  },
  boundaryPanel: {
    ...wmStyles.infoNotice,
    display: "grid",
    gap: "6px",
    padding: "16px",
  },
  ackPanel: {
    ...wmStyles.infoNotice,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap" as const,
    padding: "16px",
  },
  panelLabel: {
    ...wmStyles.eyebrow,
    color: wm.colors.infoText,
    margin: 0,
  },
  panelTitle: {
    margin: "0 0 6px",
    color: wm.colors.text,
    fontSize: "19px",
    fontWeight: 700,
  },
  panelText: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.45,
  },
  sessionText: {
    margin: "6px 0 0",
    color: wm.colors.textMuted,
    fontSize: "12px",
    fontWeight: 700,
  },
  primaryButton: {
    ...wmStyles.primaryButton,
    flex: "0 0 auto",
    padding: "10px 14px",
  },
  scheduleEditor: {
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
  timeField: {
    display: "grid",
    gap: "5px",
    color: wm.colors.textSecondary,
    fontSize: "12px",
    fontWeight: 800,
  },
  timeInput: {
    minHeight: "42px",
    border: `1px solid ${wm.colors.border}`,
    borderRadius: wm.radius.md,
    background: wm.colors.surface,
    color: wm.colors.text,
    padding: "8px 10px",
    font: "inherit",
  },
};
