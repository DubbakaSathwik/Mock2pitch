import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "inverse" | "record";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: ButtonSize; iconLeft?: IconName; iconRight?: IconName; fullWidth?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy while an action (save, upload, page change) is running. The label stays, so the width does not jump. */
  loading?: boolean;
};
const IC = { sm: 16, md: 18, lg: 20 } as const;

export function Button({ variant = "primary", size = "md", iconLeft, iconRight, fullWidth, loading, className, children, type = "button", disabled, ...rest }: ButtonProps) {
  const cls = [styles.btn, styles[variant], styles[size], fullWidth ? styles.full : "", loading ? styles.loading : "", className ?? ""].join(" ").trim();
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={styles.spin} aria-hidden="true" /> : iconLeft && <Icon name={iconLeft} size={IC[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={IC[size]} />}
    </button>
  );
}
