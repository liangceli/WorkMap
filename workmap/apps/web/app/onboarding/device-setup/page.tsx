"use client";

import { useRouter } from "next/navigation";
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
          This frontend demo explains what the Desktop Agent and Browser Extension will collect after backend contracts are approved.
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
    background: "#f3f7fb",
    color: "#0f172a",
    fontFamily: "Arial, Helvetica, sans-serif",
    padding: "24px",
  },
  shell: {
    width: "min(960px, 100%)",
    display: "grid",
    gap: "16px",
  },
  eyebrow: {
    margin: 0,
    color: "#2563eb",
    fontSize: "12px",
    fontWeight: 900,
    textTransform: "uppercase" as const,
  },
  title: {
    margin: 0,
    fontSize: "38px",
    lineHeight: 1.08,
  },
  subtitle: {
    margin: 0,
    color: "#475569",
    fontSize: "16px",
    lineHeight: 1.5,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },
  card: {
    border: "1px solid #dbe3ef",
    borderRadius: "8px",
    background: "#ffffff",
    padding: "16px",
  },
  cardTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
  },
  list: {
    margin: 0,
    paddingLeft: "18px",
    color: "#334155",
    fontSize: "14px",
    lineHeight: 1.8,
  },
  notice: {
    display: "grid",
    gap: "5px",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: "12px 14px",
    fontSize: "14px",
  },
  button: {
    justifySelf: "start",
    border: "1px solid #0f172a",
    borderRadius: "8px",
    background: "#0f172a",
    color: "#ffffff",
    padding: "12px 16px",
    cursor: "pointer",
    fontWeight: 900,
  },
};
