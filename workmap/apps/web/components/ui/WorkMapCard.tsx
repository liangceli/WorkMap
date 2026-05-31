import type { HTMLAttributes, ReactNode } from "react";
import { wmStyles } from "../../lib/theme/workmapTheme";

type WorkMapCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  elevated?: boolean;
  as?: "section" | "article" | "aside" | "div";
};

export function WorkMapCard({ children, elevated = false, as: Element = "section", style, ...props }: WorkMapCardProps) {
  return (
    <Element {...props} style={{ ...(elevated ? wmStyles.elevatedCard : wmStyles.card), padding: "16px", ...style }}>
      {children}
    </Element>
  );
}
