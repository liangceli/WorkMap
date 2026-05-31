"use client";

import type { ReactNode } from "react";
import { wm } from "../../lib/theme/workmapTheme";

type VirtualOfficeShellProps = {
  children: ReactNode;
};

export function VirtualOfficeShell({ children }: VirtualOfficeShellProps) {
  return <section style={styles.shell}>{children}</section>;
}

const styles = {
  shell: {
    position: "relative" as const,
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: wm.colors.surfaceHighest,
  },
};
