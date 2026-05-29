import type { UserPresenceStatus } from "@workmap/shared-types";
import { labelStatus, statusColors } from "./presence";

type PresenceBadgeProps = {
  status: UserPresenceStatus;
};

export function PresenceBadge({ status }: PresenceBadgeProps) {
  return (
    <span style={styles.badge}>
      <span style={{ ...styles.dot, background: statusColors[status] }} />
      {labelStatus(status)}
    </span>
  );
}

const styles = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: "8px",
    padding: "8px 12px",
    textTransform: "capitalize" as const,
    fontSize: "14px",
  },
  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "999px",
  },
};
