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
  "Presence in the virtual office",
  "Avatar location and room/area",
  "Workspace status and freshness",
  "Desktop app name and usage duration",
  "Browser domain name and usage duration",
  "Device registration and heartbeat status",
  "Last-seen timestamp",
  "Policy acknowledgement timestamp",
  "CandidGrid in-app messages, waves, reactions, and Notice read state",
];

const notVisibleItems = [
  "Screenshots are not collected",
  "Screen recordings are not collected",
  "Keystrokes are not collected",
  "Clipboard contents are not collected",
  "Webcam or microphone data is not collected",
  "External private message, Teams, or email body content is not collected",
  "Webpage body, form inputs, and passwords are not collected",
  "Full URL paths, query strings, and fragments are not collected",
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
        setStatusText("Sign in with Cognito to load and record backend policy acknowledgement. Safe transparency copy is shown below.");
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
        setStatusText("Backend policy could not be loaded. Safe transparency copy is shown, and no acknowledgement is recorded.");
        return;
      }

      setPolicy(policyResult.data);
      setWorkdayStart(policyResult.data.workdayStart);
      setWorkdayEnd(policyResult.data.workdayEnd);
      const storedAcknowledgement = readAcknowledgement(auth, policyResult.data.id);
      setAcknowledgedAt(storedAcknowledgement);
      setStatusText(
        storedAcknowledgement
          ? `Policy ${policyResult.data.policyVersion} was acknowledged from this browser at ${storedAcknowledgement}.`
          : `Backend policy ${policyResult.data.policyVersion} loaded for this Cognito session.`,
      );
    }

    void loadPolicy();

    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledgePolicy = async () => {
    if (!policy) {
      setStatusText("Policy acknowledgement needs a loaded backend policy. The transparency notice remains available for review.");
      setModalOpen(false);
      return;
    }

    setAcknowledging(true);
    const auth = await getWorkMapApiAuthOptions();

    if (!auth.available) {
      setAcknowledging(false);
      setStatusText("No active API session is available. Sign in with Cognito before recording acknowledgement.");
      setModalOpen(false);
      return;
    }

    const result = await acknowledgeCompliancePolicy(policy.id, auth.options);
    setAcknowledging(false);

    if (!result.ok) {
      setStatusText("Backend acknowledgement failed. No local-only policy acknowledgement was recorded.");
      setModalOpen(false);
      return;
    }

    const acknowledged = new Date(result.data.acknowledgedAt).toLocaleString();
    setAcknowledgedAt(acknowledged);
    writeAcknowledgement(auth, policy.id, acknowledged);
    setStatusText(`Policy ${policy.policyVersion} acknowledged at ${acknowledged}.`);
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
      `Policy ${result.data.policyVersion} now includes App open/runtime collection. Review and acknowledge this new version before the Agent receives an authorised runtime lease.`,
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
      `Policy ${result.data.policyVersion} now includes Browser Domain open/runtime collection. Review and acknowledge this new version before Browser Extensions receive an authorised runtime lease.`,
    );
  };

  return (
    <div className="wm-compliance-policy" style={styles.stack}>
      <section className="wm-compliance-card-grid" style={styles.policyGrid}>
        <PolicyList title="Visible in CandidGrid" tone="blue" items={visibleItems} />
        <PolicyList title="Not monitored" tone="green" items={notVisibleItems} />
      </section>

      <section className="wm-compliance-card-grid" style={styles.explanationGrid}>
        <TrustCard
          title="Why this data exists"
          text="CandidGrid uses presence, app/domain duration summaries, device heartbeat, and acknowledgement timestamps to help a tenant understand workspace setup and transparent activity coverage."
        />
        <TrustCard
          title="Who can see what"
          text="Employees can review their own summaries and compliance state. Owners and allowed manager roles can review company aggregate summaries, not private content or raw cross-tenant rows."
        />
        <TrustCard
          title="Alpha client limitation"
          text="The Windows Desktop Agent and MV3 Browser Extension use short-lived pairing codes, device-scoped credentials, bounded offline queues, retry backoff, and revocation. Final consolidated manual installation and runtime QA remains pending."
        />
      </section>

      <section style={styles.boundaryPanel}>
        <p style={styles.panelLabel}>Role visibility boundary</p>
        <p style={styles.panelText}>
          Employees can understand their own presence and activity summaries. Owner and manager views may show role-allowed aggregate
          app/domain summaries for the tenant, while employee-level activity detail remains guarded by backend RBAC and tenant scope.
          Platform Admin views are separate and should remain limited to privacy-safe tenant metadata and health/audit summaries.
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
              Foreground App collection runs only inside this local workspace window. Secure heartbeats continue outside it. This control extends an active schedule; narrowing it requires a new policy version so existing leases cannot keep a broader window.
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
          <p style={styles.panelLabel}>Policy acknowledgement</p>
          <h2 style={styles.panelTitle}>{acknowledgedAt ? "Acknowledged" : policy ? "Backend policy ready" : "Transparency notice"}</h2>
          <p style={styles.panelText}>
            {loading
              ? "Checking the current API session..."
              : statusText}
          </p>
          {authSource ? <p style={styles.sessionText}>API context: {authSource}</p> : null}
          {policy ? (
            <p style={styles.sessionText}>
              {policy.name} / version {policy.policyVersion} / retention {policy.retentionDays} days
            </p>
          ) : null}
        </div>
        <button type="button" onClick={() => setModalOpen(true)} style={styles.primaryButton}>
          {policy ? "Review and acknowledge" : "Review notice"}
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
