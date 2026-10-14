import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./IconButton.module.css";

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  icon: IconName; label: string; variant?: "ghost" | "secondary" | "primary" | "inverse"; size?: number;
};

export function IconButton({ icon, label, variant = "ghost", size = 40, className, style, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={label} className={[styles.ib, styles[variant], className ?? ""].join(" ").trim()} style={{ width: size, height: size, ...style }} {...rest}>
      <Icon name={icon} size={Math.round(size * 0.48)} />
    </button>
  );
}
