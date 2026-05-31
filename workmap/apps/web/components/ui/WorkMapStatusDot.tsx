import type { UserPresenceStatus } from "@workmap/shared-types";
import { wm } from "../../lib/theme/workmapTheme";

export function WorkMapStatusDot({ status, size = 10 }: { status: UserPresenceStatus; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: wm.radius.full,
        background: wm.status[status],
        boxShadow: `0 0 0 2px ${wm.colors.surface}`,
      }}
    />
  );
}
