"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkMapLoader } from "../../../components/ui/WorkMapLoader";
import { createDevicePairingCode, getDevicePairingStatus, listDevices } from "../../../lib/api/devicesApi";
import { getWorkMapApiAuthOptions } from "../../../lib/api/apiAuth";
import { redirectToRootForMissingCognitoSession } from "../../../lib/auth/cognitoRedirect";
import type { WorkMapApiPairingCode, WorkMapApiPairingStatus } from "../../../lib/api/apiTypes";
import { wm, wmStyles } from "../../../lib/theme/workmapTheme";
import { getNextRouteForUser, updateUserSetupState } from "../../../lib/workflow/workflowState";

const desktopItems = ["Foreground application product name", "Usage start/end and active duration", "Agent start, stop, and connection health"];
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
  const desktopAgentDownloadUrl = process.env.NEXT_PUBLIC_WORKMAP_DESKTOP_AGENT_URL?.trim();
  const browserExtensionDownloadUrl = process.env.NEXT_PUBLIC_WORKMAP_BROWSER_EXTENSION_URL?.trim();
  const router = useRouter();
  const [pairing, setPairing] = useState<WorkMapApiPairingCode | null>(null);
  const [pairingStatus, setPairingStatus] = useState<WorkMapApiPairingStatus["status"] | null>(null);
  const [pairingState, setPairingState] = useState<"idle" | "loading" | "error">("idle");
  const [pairingMessage, setPairingMessage] = useState("");
  const [hasPairedDesktopAgent, setHasPairedDesktopAgent] = useState(false);
  const [hasPairedBrowserExtension, setHasPairedBrowserExtension] = useState(false);
  const [checkingDesktopAgent, setCheckingDesktopAgent] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkExistingDesktopAgent() {
      const auth = await getWorkMapApiAuthOptions();
      if (!auth.available) {
        if (redirectToRootForMissingCognitoSession()) return;
        if (!cancelled) setCheckingDesktopAgent(false);
        return;
      }
      const result = await listDevices(auth.options);
      if (!cancelled) {
        setHasPairedDesktopAgent(
          result.ok && result.data.some(
            (device) => !device.revokedAt && device.agentVersion?.startsWith("desktop-agent-windows/"),
          ),
        );
        setHasPairedBrowserExtension(
          result.ok && result.data.some(
            (device) => !device.revokedAt && device.agentVersion?.startsWith("browser-extension-mv3/"),
          ),
        );
        setCheckingDesktopAgent(false);
      }
    }

    void checkExistingDesktopAgent();
    return () => { cancelled = true; };
  }, []);

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
      if (!auth.available) {
        if (!cancelled) redirectToRootForMissingCognitoSession();
        return;
      }
      if (cancelled) return;
      const result = await getDevicePairingStatus(pairing.id, auth.options);
      if (cancelled) return;
      if (result.ok) {
        setPairingStatus(result.data.status);
        if (result.data.status === "paired" && result.data.clientType === "DESKTOP_AGENT") {
          setHasPairedDesktopAgent(true);
        }
        if (result.data.status === "paired" && result.data.clientType === "BROWSER_EXTENSION") {
          setHasPairedBrowserExtension(true);
        }
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
      if (redirectToRootForMissingCognitoSession()) return;
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

  if (checkingDesktopAgent) {
    return <WorkMapLoader fullPage label="Checking account access" />;
  }

  return (
    <main className="wm-onboarding-page wm-device-onboarding" style={styles.page}>
      <section className="wm-onboarding-shell" style={styles.shell}>
        <p style={styles.eyebrow}>Device setup</p>
        <h1 style={styles.title}>Connect WorkMap presence tools</h1>
        <p style={styles.subtitle}>
          Review what the paired Desktop Agent and Browser Extension collect before enabling transparent activity summaries.
        </p>

        <div className="wm-device-boundary-grid" style={styles.grid}>
          <InfoCard title="Desktop Agent" items={desktopItems} />
          <InfoCard title="Browser Extension" items={extensionItems} />
          <InfoCard title="Not collected" items={notCollectedItems} />
        </div>

        <section style={styles.notice}>
          <strong>Transparent setup</strong>
          <span>Employees should see these boundaries before device metadata collection is enabled.</span>
        </section>

        <div className="wm-device-pairing-grid">
          <section className="wm-device-pairing-panel" style={styles.pairingPanel}>
            <div>
              <p style={styles.panelEyebrow}>Windows application monitoring</p>
              <h2 style={styles.cardTitle}>Desktop Agent</h2>
              <p style={styles.subtitle}>Install the Windows Agent once, then connect it with a one-time code. After pairing, it starts automatically at Windows sign-in.</p>
            </div>
            <ol style={styles.setupSteps}>
              <li>Download and open the Windows installer on this employee computer.</li>
              <li>Generate a Desktop Agent code below and enter it in the Agent window.</li>
              <li>Wait for the connected confirmation. Future Windows sign-ins start the Agent automatically.</li>
            </ol>
            <div style={styles.actions}>
              {desktopAgentDownloadUrl ? (
                <a href={desktopAgentDownloadUrl} download style={styles.downloadButton}>Download Windows installer</a>
              ) : (
                <span style={styles.downloadUnavailable}>Windows download pending release configuration</span>
              )}
              <button type="button" onClick={() => void createPairing("DESKTOP_AGENT")} disabled={pairingState === "loading"} style={styles.secondaryButton}>
                Generate Agent code
              </button>
            </div>
            <p style={hasPairedDesktopAgent ? styles.readyMessage : styles.requirementMessage}>
              {hasPairedDesktopAgent
                ? "Desktop Agent connected."
                : "Download, install, and pair the Desktop Agent to continue."}
            </p>
          </section>

          <section className="wm-device-pairing-panel" style={styles.pairingPanel}>
            <div>
              <p style={styles.panelEyebrow}>Browser domain monitoring - Alpha</p>
              <h2 style={styles.cardTitle}>Browser Extension manual setup</h2>
              <p style={styles.subtitle}>Use this Developer mode installation only for the current controlled Chrome or Edge test.</p>
            </div>
            <ol style={styles.setupSteps}>
              <li>Download the ZIP, extract it to a permanent folder, and do not move or delete that folder.</li>
              <li>Open <code>chrome://extensions</code> or <code>edge://extensions</code>, enable Developer mode, then choose Load unpacked and select the extracted folder.</li>
              <li>Open the extension details and allow site access, then generate a code below and enter it on the extension Options page.</li>
              <li>Keep the extension enabled. Future Alpha updates require replacing the files and selecting Reload on the extensions page.</li>
            </ol>
            <div style={styles.actions}>
              {browserExtensionDownloadUrl ? (
                <a href={browserExtensionDownloadUrl} download style={styles.downloadButton}>Download extension ZIP</a>
              ) : (
                <span style={styles.downloadUnavailable}>Extension ZIP pending release configuration</span>
              )}
              <button type="button" onClick={() => void createPairing("BROWSER_EXTENSION")} disabled={pairingState === "loading"} style={styles.secondaryButton}>
                Generate Extension code
              </button>
            </div>
            <p style={hasPairedBrowserExtension ? styles.readyMessage : styles.requirementMessage}>
              {hasPairedBrowserExtension
                ? "Browser Extension paired. Keep Developer mode and the extension enabled during the Alpha test."
                : "The Browser Extension is optional for continuing, but it must be paired before domain monitoring starts."}
            </p>
          </section>
        </div>

        {pairing ? (
          <section style={styles.pairingResult} aria-live="polite">
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
            {pairingMessage ? <p style={styles.error}>{pairingMessage}</p> : null}
          </section>
        ) : pairingMessage ? <p style={styles.error}>{pairingMessage}</p> : null}

        <button
          type="button"
          onClick={continueToOffice}
          disabled={!hasPairedDesktopAgent || checkingDesktopAgent}
          style={{
            ...styles.button,
            ...(!hasPairedDesktopAgent || checkingDesktopAgent ? styles.buttonDisabled : null),
          }}
        >
          Continue to virtual office
        </button>
      </section>
    </main>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="wm-device-boundary-card" style={styles.card}>
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
  buttonDisabled: {
    cursor: "not-allowed",
    opacity: 0.45,
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
  panelEyebrow: {
    margin: "0 0 4px",
    color: wm.colors.secondary,
    fontSize: "11px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  pairingResult: {
    display: "grid",
    gap: "8px",
  },
  setupSteps: {
    margin: 0,
    paddingLeft: "20px",
    color: wm.colors.textSecondary,
    fontSize: "14px",
    lineHeight: 1.7,
  },
  downloadButton: {
    ...wmStyles.primaryButton,
    padding: "10px 14px",
    fontWeight: 900,
    textDecoration: "none",
  },
  downloadUnavailable: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "40px",
    padding: "8px 12px",
    border: `1px solid ${wm.colors.warningBorder}`,
    borderRadius: wm.radius.md,
    background: wm.colors.warningBg,
    color: wm.colors.warning,
    fontSize: "13px",
    fontWeight: 800,
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
  requirementMessage: {
    margin: 0,
    color: wm.colors.textMuted,
    fontSize: "13px",
    fontWeight: 700,
  },
  readyMessage: {
    margin: 0,
    color: wm.colors.success,
    fontSize: "13px",
    fontWeight: 800,
  },
};
