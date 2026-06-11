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
  "Active desktop app name and usage duration",
  "Browser domain name and active duration",
  "Device registration and heartbeat status",
  "Last-seen timestamp",
  "Policy acknowledgement timestamp",
];

const notVisibleItems = [
  "Screen recording",
  "Screenshots",
  "Keystroke logging",
  "Clipboard contents",
  "Hidden webcam or microphone monitoring",
  "Private message or email content",
  "Browser page body content",
  "Full URL paths, query strings, form inputs, or passwords",
  "Invisible employee spying",
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
        setStatusText("Sign in with pilot auth to load and record backend policy acknowledgement. Safe transparency copy is shown below.");
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
          : `Backend policy ${policyResult.data.policyVersion} loaded for this pilot session.`,
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
      setStatusText("No active API session is available. Sign in with pilot auth before recording acknowledgement.");
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

      <section style={styles.boundaryPanel}>
        <p style={styles.panelLabel}>Role visibility boundary</p>
        <p style={styles.panelText}>
          Employees can understand their own presence and activity summaries. Owner and manager views may show role-allowed aggregate
          app/domain summaries for the tenant, while employee-level activity detail remains guarded by backend RBAC and tenant scope.
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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
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
