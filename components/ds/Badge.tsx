import type { HTMLAttributes } from "react";
import styles from "./Badge.module.css";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "violet" | "solid";
export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean };

export function Badge({ tone = "neutral", dot, className, children, ...rest }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[tone], className ?? ""].join(" ").trim()} {...rest}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
