"use client";
import { useId, type TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string; hint?: string; error?: string;
  /** Right-aligned live counter under the box, e.g. "12 / 50 words". Turns red with `counterOver`. */
  counter?: string; counterOver?: boolean; wrapperClassName?: string;
};

/** Multi-line text field in the Input style (label, hint, error, optional live counter). */
export function Textarea({ label, hint, error, counter, counterOver, id, className, wrapperClassName, rows = 3, ...rest }: TextareaProps) {
  const auto = useId();
  const iid = id ?? auto;
  const msgId = `${iid}-msg`;
  return (
    <div className={[styles.field, wrapperClassName ?? ""].join(" ").trim()}>
      {label && <label htmlFor={iid} className={styles.label}>{label}</label>}
      <textarea id={iid} rows={rows} className={[styles.area, error ? styles.err : "", className ?? ""].join(" ").trim()} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? msgId : undefined} {...rest} />
      <div className={styles.foot}>
        {(error || hint) ? <span id={msgId} className={error ? styles.msgErr : styles.msg} role={error ? "alert" : undefined}>{error || hint}</span> : <span />}
        {counter && <span className={counterOver ? styles.msgErr : styles.msg} aria-live="polite">{counter}</span>}
      </div>
    </div>
  );
}
