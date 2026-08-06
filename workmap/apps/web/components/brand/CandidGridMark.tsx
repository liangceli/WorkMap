import type { CSSProperties } from "react";

type CandidGridMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  tone?: "light" | "dark";
  style?: CSSProperties;
};

export function CandidGridMark({
  size = 32,
  className,
  tone = "light",
  style,
}: CandidGridMarkProps) {
  const cellColor = tone === "dark" ? "#f7f7f2" : "#080d22";

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <path fill={cellColor} d="M9 4h8a5 5 0 0 1 5 5v7l-6 6H9a5 5 0 0 1-5-5V9a5 5 0 0 1 5-5Z" />
      <path fill="#27e0a2" d="M31 4h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-7l-6-6V9a5 5 0 0 1 5-5Z" />
      <path fill={cellColor} d="M9 26h7l6 6v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5Z" />
      <path fill={cellColor} d="M32 26h7a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-7l6-6Z" />
    </svg>
  );
}
