import type { ReactNode } from "react";
import { wmStyles } from "../../lib/theme/workmapTheme";

type WorkMapPageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
};

export function WorkMapPageHeader({ eyebrow, title, subtitle, actions }: WorkMapPageHeaderProps) {
  return (
    <header style={wmStyles.pageHeader}>
      <div>
        <p style={wmStyles.eyebrow}>{eyebrow}</p>
        <h1 style={wmStyles.pageTitle}>{title}</h1>
        <p style={wmStyles.pageSubtitle}>{subtitle}</p>
      </div>
      {actions ? <nav style={styles.actions}>{actions}</nav> : null}
    </header>
  );
}

const styles = {
  actions: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap" as const,
  },
};
