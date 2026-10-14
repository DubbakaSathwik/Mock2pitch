"use client";
import { useId, type InputHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Input.module.css";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { label?: string; hint?: string; error?: string; icon?: IconName; wrapperClassName?: string };

export function Input({ label, hint, error, icon, id, className, wrapperClassName, ...rest }: InputProps) {
  const auto = useId();
  const iid = id ?? auto;
  const msgId = `${iid}-msg`;
  return (
    <div className={[styles.field, wrapperClassName ?? ""].join(" ").trim()}>
      {label && <label htmlFor={iid} className={styles.label}>{label}</label>}
      <span className={`${styles.box} ${error ? styles.err : ""}`}>
        {icon && <Icon name={icon} size={18} color="var(--ink-500)" />}
        <input id={iid} className={[styles.input, className ?? ""].join(" ").trim()} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? msgId : undefined} {...rest} />
      </span>
      {(error || hint) && <span id={msgId} className={error ? styles.msgErr : styles.msg} role={error ? "alert" : undefined}>{error || hint}</span>}
    </div>
  );
}
