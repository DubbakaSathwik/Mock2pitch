import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "inverse" | "record";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: ButtonSize; iconLeft?: IconName; iconRight?: IconName; fullWidth?: boolean;
};
const IC = { sm: 16, md: 18, lg: 20 } as const;

export function Button({ variant = "primary", size = "md", iconLeft, iconRight, fullWidth, className, children, type = "button", ...rest }: ButtonProps) {
  const cls = [styles.btn, styles[variant], styles[size], fullWidth ? styles.full : "", className ?? ""].join(" ").trim();
  return (
    <button type={type} className={cls} {...rest}>
      {iconLeft && <Icon name={iconLeft} size={IC[size]} />}
      {children}
      {iconRight && <Icon name={iconRight} size={IC[size]} />}
    </button>
  );
}
