import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

export type CardProps = HTMLAttributes<HTMLElement> & {
  variant?: "default" | "sunken" | "accent" | "inverse"; padding?: number | string; interactive?: boolean; as?: "div" | "section" | "article" | "li";
};

export function Card({ variant = "default", padding = 24, interactive, as: Tag = "div", className, style, children, ...rest }: CardProps) {
  return (
    <Tag className={[styles.card, styles[variant], interactive ? styles.interactive : "", className ?? ""].join(" ").trim()} style={{ padding, ...style }} {...rest}>
      {children}
    </Tag>
  );
}
