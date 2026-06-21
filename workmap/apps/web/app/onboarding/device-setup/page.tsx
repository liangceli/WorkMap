"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createDevicePairingCode, getDevicePairingStatus } from "../../../lib/api/devicesApi";
import { getWorkMapApiAuthOptions } from "../../../lib/api/apiAuth";
import type { WorkMapApiPairingCode, WorkMapApiPairingStatus } from "../../../lib/api/apiTypes";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";
import { getNextRouteForUser, updateUserSetupState } from "../../../lib/workflow/workflowState";

const desktopItems = ["Active app name", "Idle state", "Device heartbeat"];
const extensionItems = ["Active website domain only"];
const notCollectedItems = [
  "Full URLs by default",
  "Passwords",
  "Form inputs",
  "Screenshots",
  "Keystrokes",
  "Message/email content",
  "Camera/microphone",
];

export default function DeviceSetupPage() {
  const router = useRouter();
  const [pairing, setPairing] = useState<WorkMapApiPairingCode | null>(null);
  const [pairingStatus, setPairingStatus] = useState<WorkMapApiPairingStatus["status"] | null>(null);
  const [pairingState, setPairingState] = useState<"idle" | "loading" | "error">("idle");
  const [pairingMessage, setPairingMessage] = useState("");

  useEffect(() => {
    if (!pairing || pairingStatus !== "pending") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (Date.now() >= Date.parse(pairing.expiresAt)) {
        if (!cancelled) setPairingStatus("expired");
        return;
      }
      const auth = await getWorkMapApiAuthOptions();
      if (!auth.available || cancelled) return;
      const result = await getDevicePairingStatus(pairing.id, auth.options);
      if (cancelled) return;
      if (result.ok) {
        setPairingStatus(result.data.status);
        if (result.data.status !== "pending") return;
      }
      timer = setTimeout(() => void poll(), 2_000);
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pairing, pairingStatus]);

  const createPairing = async (clientType: "DESKTOP_AGENT" | "BROWSER_EXTENSION") => {
    setPairingState("loading");
    setPairingMessage("");
    const auth = await getWorkMapApiAuthOptions();
    if (!auth.available) {
      setPairingState("error");
      setPairingMessage(auth.reason);
      return;
    }
    const result = await createDevicePairingCode(clientType, auth.options);
    if (!result.ok) {
      setPairingState("error");
      setPairingMessage(result.error);
      return;
    }
    setPairing(result.data);
    setPairingStatus("pending");
    setPairingState("idle");
  };

  const continueToOffice = () => {
    const nextState = updateUserSetupState({ hasCompletedDeviceSetup: true }, "EMPLOYEE");
    router.push(getNextRouteForUser(nextState));
  };

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <p style={styles.eyebrow}>Device setup</p>
        <h1 style={styles.title}>Connect WorkMap presence tools</h1>
        <p style={styles.subtitle}>
          Review what the paired Desktop Agent and Browser Extension collect before enabling transparent activity summaries.
        </p>

        <div style={styles.grid}>
          <InfoCard title="Desktop Agent" items={desktopItems} />
          <InfoCard title="Browser Extension" items={extensionItems} />
          <InfoCard title="Not collected" items={notCollectedItems} />
        </div>

        <section style={styles.notice}>
          <strong>Transparent setup</strong>
          <span>Employees should see these boundaries before device metadata collection is enabled.</span>
        </section>

        <section style={styles.pairingPanel}>
          <div>
            <h2 style={styles.cardTitle}>Pair a tracking client</h2>
            <p style={styles.subtitle}>Generate a one-time code. It expires after 10 minutes and can be exchanged only once.</p>
          </div>
          <div style={styles.actions}>
            <button type="button" onClick={() => void createPairing("DESKTOP_AGENT")} disabled={pairingState === "loading"} style={styles.secondaryButton}>
              Pair Desktop Agent
            </button>
            <button type="button" onClick={() => void createPairing("BROWSER_EXTENSION")} disabled={pairingState === "loading"} style={styles.secondaryButton}>
              Pair Browser Extension
            </button>
          </div>
          {pairing ? (
            <div style={styles.codeBox}>
              {pairingStatus === "pending" ? <strong style={styles.code}>{pairing.code}</strong> : null}
              <span>
                {pairingStatus === "paired"
                  ? `${pairing.clientType === "DESKTOP_AGENT" ? "Desktop Agent" : "Browser Extension"} paired successfully.`
                  : pairingStatus === "expired"
                    ? "This pairing code expired. Generate a new code to continue."
                    : `${pairing.clientType === "DESKTOP_AGENT" ? "Desktop Agent" : "Browser Extension"} code expires ${new Date(pairing.expiresAt).toLocaleTimeString()}.`}
              </span>
            </div>
          ) : null}
          {pairingMessage ? <p style={styles.error}>{pairingMessage}</p> : null}
        </section>

        <button type="button" onClick={continueToOffice} style={styles.button}>
          Continue to virtual office
        </button>
      </section>
    </main>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <ul style={styles.list}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: wm.colors.appBackground,
    color: wm.colors.text,
    fontFamily: wm.typography.fontFamily,
    padding: "var(--wm-shell-block) var(--wm-shell-inline)",
  },
  shell: {
    width: "min(960px, 100%)",
    display: "grid",
    gap: "16px",
  },
  eyebrow: {
    margin: 0,
    color: wm.colors.secondary,
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    color: wm.colors.textHeading,
    fontFamily: wm.typography.displayFontFamily,
    fontSize: "34px",
    lineHeight: 1.15,
    fontWeight: 750,
    letterSpacing: 0,
  },
  subtitle: {
    margin: 0,
    color: wm.colors.textSecondary,
    fontSize: "16px",
    lineHeight: 1.5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
    gap: "14px",
  },
  card: {
    ...wmStyles.card,
    padding: "16px",
  },
  cardTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.8,
  },
  notice: {
    display: "grid",
    gap: "5px",
    ...wmStyles.infoNotice,
    padding: "12px 14px",
    fontSize: "14px",
  },
  button: {
    justifySelf: "start",
    ...wmStyles.primaryButton,
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 900,
  },
  pairingPanel: {
    ...wmStyles.card,
    padding: "16px",
    display: "grid",
    gap: "12px",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "10px",
  },
  secondaryButton: {
    ...wmStyles.secondaryButton,
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: 800,
  },
  codeBox: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: "12px",
    ...wmStyles.infoNotice,
    padding: "12px 14px",
  },
  code: {
    fontFamily: "monospace",
    fontSize: "22px",
    letterSpacing: 0,
  },
  error: {
    margin: 0,
    color: wm.colors.error,
    fontSize: "14px",
  },
};
