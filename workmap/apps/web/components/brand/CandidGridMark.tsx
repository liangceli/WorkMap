import Image from "next/image";
import type { CSSProperties } from "react";

type CandidGridMarkProps = {
  size?: number;
  className?: string;
  priority?: boolean;
  style?: CSSProperties;
};

export function CandidGridMark({
  size = 32,
  className,
  priority = false,
  style,
}: CandidGridMarkProps) {
  return (
    <Image
      src="/brand/candidgrid-mark.png"
      alt=""
      width={size}
      height={size}
      className={className}
      priority={priority}
      aria-hidden="true"
      style={style}
    />
  );
}
