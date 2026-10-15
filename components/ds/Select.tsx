"use client";
import { useId, type SelectHTMLAttributes } from "react";
import { Icon } from "./Icon";
import styles from "./Select.module.css";

export type SelectOption = string | { value: string; label: string };
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options?: readonly SelectOption[]; error?: string };

export function Select({ label, options = [], id, error, className, ...rest }: SelectProps) {
  const auto = useId();
  const iid = id ?? auto;
  return (
    <div className={styles.field}>
      {label && <label htmlFor={iid} className={styles.label}>{label}</label>}
      <span className={styles.wrap}>
        <select id={iid} className={[styles.select, className ?? ""].join(" ").trim()} aria-invalid={error ? true : undefined} {...rest}>
          {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
        <Icon name="chevron-down" size={18} color="var(--ink-500)" style={{ position: "absolute", right: 14, top: 13, pointerEvents: "none" }} />
      </span>
      {error && <span className={styles.err} role="alert">{error}</span>}
    </div>
  );
}
