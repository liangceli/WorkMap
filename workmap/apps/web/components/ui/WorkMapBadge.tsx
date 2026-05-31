import type { HTMLAttributes, ReactNode } from "react";
import { wm } from "../../lib/theme/workmapTheme";

type BadgeTone = "info" | "success" | "warning" | "neutral" | "compliance";

export function WorkMapBadge({
  children,
  tone = "neutral",
  style,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span {...props} style={{ ...baseStyle, ...toneStyles[tone], ...style }}>
      {children}
    </span>
  );
}

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  borderRadius: wm.radius.full,
  padding: "5px 9px",
  fontSize: "12px",
  fontWeight: 900,
  lineHeight: 1,
};

const toneStyles = {
  info: { border: `1px solid ${wm.colors.infoBorder}`, background: wm.colors.infoBg, color: wm.colors.infoText },
  success: { border: `1px solid ${wm.colors.successBorder}`, background: wm.colors.successBg, color: wm.colors.success },
  warning: { border: `1px solid ${wm.colors.warningBorder}`, background: wm.colors.warningBg, color: wm.colors.warning },
  neutral: { border: `1px solid ${wm.colors.border}`, background: wm.colors.surfaceLow, color: wm.colors.textSecondary },
  compliance: { border: `1px solid ${wm.colors.complianceBorder}`, background: wm.colors.complianceBg, color: wm.colors.compliance },
} as const;
