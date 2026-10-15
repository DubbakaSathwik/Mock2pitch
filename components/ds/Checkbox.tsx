"use client";
import { useId } from "react";
import { Icon } from "./Icon";
import styles from "./Checkbox.module.css";

export type CheckboxProps = { checked: boolean; onChange?: (checked: boolean) => void; label: React.ReactNode; disabled?: boolean; id?: string };

/** Native checkbox (keyboard + screen-reader friendly) drawn with the design's box. */
export function Checkbox({ checked, onChange, label, disabled, id }: CheckboxProps) {
  const auto = useId();
  const iid = id ?? auto;
  return (
    <label htmlFor={iid} className={`${styles.wrap} ${disabled ? styles.disabled : ""}`}>
      <input id={iid} type="checkbox" className={styles.native} checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      <span className={`${styles.box} ${checked ? styles.on : ""}`} aria-hidden="true">{checked && <Icon name="check" size={14} color="var(--white)" />}</span>
      <span>{label}</span>
    </label>
  );
}
