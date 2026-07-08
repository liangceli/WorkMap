import type { UserPresenceStatus } from "@workmap/shared-types";
import { deviceActivityStatusLabel, type DeviceActivityStatus } from "../../lib/people/peopleStatus";
import { wm } from "../../lib/theme/workmapTheme";
import { PresenceBadge } from "../office/PresenceBadge";

type EmployeeStatusStackProps = {
  virtualStatus: UserPresenceStatus;
  deviceStatus?: DeviceActivityStatus;
};

export function EmployeeStatusStack({ virtualStatus, deviceStatus = "no_report" }: EmployeeStatusStackProps) {
  return (
    <div style={styles.stack}>
      <div style={styles.statusRow}>
        <span style={styles.label}>Virtual map</span>
        <PresenceBadge status={virtualStatus} />
      </div>
      <div style={styles.statusRow}>
        <span style={styles.label}>Device</span>
        <DeviceActivityBadge status={deviceStatus} />
      </div>
    </div>
  );
}

export function DeviceActivityBadge({ status }: { status: DeviceActivityStatus }) {
  return <span style={{ ...styles.deviceBadge, ...deviceTone(status) }}>{deviceActivityStatusLabel(status)}</span>;
}

function deviceTone(status: DeviceActivityStatus) {
  if (status === "focus_active") {
    return {
      color: wm.colors.success,
      borderColor: wm.colors.successBorder,
      background: wm.colors.successBg,
    };
  }

  if (status === "focused_idle" || status === "signal_delayed") {
    return {
      color: wm.colors.warning,
      borderColor: wm.colors.warningBorder,
      background: wm.colors.warningBg,
    };
  }

  if (status === "open_runtime") {
    return {
      color: wm.colors.infoText,
      borderColor: wm.colors.infoBorder,
      background: wm.colors.infoBg,
    };
  }

  return {
    color: wm.colors.textMuted,
    borderColor: wm.colors.borderStrong,
    background: wm.colors.appBackground,
  };
}

const styles = {
  stack: {
    display: "grid",
    justifyItems: "start",
    gap: "8px",
  },
  statusRow: {
    display: "grid",
    justifyItems: "start",
    gap: "4px",
  },
  label: {
    color: wm.colors.textMuted,
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.02em",
    textTransform: "uppercase" as const,
  },
  deviceBadge: {
    border: "1px solid",
    borderRadius: wm.radius.md,
    padding: "8px 12px",
    fontSize: "14px",
    fontWeight: 700,
  },
};
