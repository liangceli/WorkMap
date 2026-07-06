import type { ReactNode } from "react";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type NoticeTone = "info" | "success" | "warning";

export function WorkMapPrivacyNotice({
  title,
  children,
  tone = "info",
}: {
  title: string;
  children: ReactNode;
  tone?: NoticeTone;
}) {
  return (
    <section className="wm-privacy-notice" style={{ ...wmStyles.notice, ...toneStyles[tone] }}>
      <strong>{title}</strong>
      <span>{children}</span>
    </section>
  );
}

const toneStyles = {
  info: { border: `1px solid ${wm.colors.infoBorder}`, background: wm.colors.infoBg, color: wm.colors.infoText },
  success: { border: `1px solid ${wm.colors.successBorder}`, background: wm.colors.successBg, color: wm.colors.compliance },
  warning: { border: `1px solid ${wm.colors.warningBorder}`, background: wm.colors.warningBg, color: wm.colors.warning },
} as const;
