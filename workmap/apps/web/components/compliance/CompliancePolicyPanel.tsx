"use client";

import { useEffect, useState } from "react";
import { PolicyAcknowledgementModal } from "./PolicyAcknowledgementModal";
import { acknowledgeCompliancePolicy, getCompliancePolicy } from "../../lib/api/complianceApi";
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
];

const notVisibleItems = [
  "Screenshots are not collected",
  "Screen recordings are not collected",
  "Keystrokes are not collected",
  "Clipboard contents are not collected",
  "Webcam or microphone data is not collected",
  "Private message or email body content is not collected",
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

  return (
    <div style={styles.stack}>
      <section style={styles.policyGrid}>
        <PolicyList title="Visible in WorkMap" tone="blue" items={visibleItems} />
        <PolicyList title="Not monitored" tone="green" items={notVisibleItems} />
      </section>

      <section style={styles.explanationGrid}>
        <TrustCard
          title="Why this data exists"
          text="WorkMap uses presence, app/domain duration summaries, device heartbeat, and acknowledgement timestamps to help a tenant understand workspace setup and transparent activity coverage."
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
};
