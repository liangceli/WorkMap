import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { wm, wmStyles } from "../../lib/theme/workmapTheme";

type ButtonTone = "primary" | "secondary" | "ghost" | "danger";
type CommonProps = {
  children: ReactNode;
  tone?: ButtonTone;
  fullWidth?: boolean;
};

type WorkMapButtonProps =
  | (CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: never })
  | (CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string });

export function WorkMapButton({ children, tone = "secondary", fullWidth = false, style, ...props }: WorkMapButtonProps) {
  const buttonStyle = {
    ...baseStyle,
    ...toneStyles[tone],
    ...(fullWidth ? { width: "100%", justifyContent: "center" } : {}),
    ...style,
  };

  if ("href" in props && props.href) {
    const anchorProps = props as AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
    return (
      <a {...anchorProps} style={buttonStyle}>
        {children}
      </a>
    );
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button {...buttonProps} style={buttonStyle}>
      {children}
    </button>
  );
}

const baseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: wm.sizes.buttonHeight,
  borderRadius: wm.radius.md,
  padding: "10px 14px",
  textAlign: "center" as const,
  boxShadow: "none",
};

const toneStyles = {
  primary: wmStyles.primaryButton,
  secondary: wmStyles.secondaryButton,
  ghost: {
    border: `1px solid ${wm.colors.borderSubtle}`,
    borderRadius: wm.radius.md,
    background: "rgba(255, 253, 248, 0.66)",
    color: wm.colors.textSecondary,
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  danger: {
    border: `1px solid ${wm.colors.error}`,
    borderRadius: wm.radius.md,
    background: wm.colors.errorBg,
    color: wm.colors.errorText,
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
  },
} as const;
