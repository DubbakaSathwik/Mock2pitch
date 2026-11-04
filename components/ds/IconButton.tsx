import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./IconButton.module.css";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  icon: IconName; label: string; variant?: "ghost" | "secondary" | "primary" | "inverse"; size?: number;
  /** Replaces the icon with a spinner and disables the button while its action runs. */
  loading?: boolean;
};

export function IconButton({ icon, label, variant = "ghost", size = 40, className, style, type = "button", loading, disabled, ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={[styles.ib, styles[variant], className ?? ""].join(" ").trim()} style={{ width: size, height: size, ...style }} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={styles.spin} aria-hidden="true" style={{ width: Math.round(size * 0.4), height: Math.round(size * 0.4) }} /> : <Icon name={icon} size={Math.round(size * 0.48)} />}
    </button>
  );
}
