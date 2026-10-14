"use client";
import { useRef, type KeyboardEvent } from "react";
import styles from "./Stars.module.css";

export function Star({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? "#E8A317" : "none"} stroke={on ? "#E8A317" : "var(--ink-300)"} strokeWidth="2" strokeLinejoin="round" style={{ display: "block" }} aria-hidden="true">
      <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21 7 14.2 2 9.3l6.9-1z" />
    </svg>
  );
}

/** Read-only row of exactly five stars. */
export function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span role="img" aria-label={`${n} out of 5 stars`} className={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => <Star key={i} on={i <= n} size={size} />)}
    </span>
  );
}

/** Rating input: a radio group of exactly five star buttons (←/→ move, Space/Enter select). */
export function StarRating({ value, onChange, size = 32, label = "Rating", disabled }: { value: number; onChange?: (n: number) => void; size?: number; label?: string; disabled?: boolean }) {
  const group = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    if (disabled) return;
    let n = value;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") n = Math.min(5, (value || 0) + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = Math.max(1, (value || 2) - 1);
    else return;
    e.preventDefault();
    onChange?.(n);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[n - 1]?.focus();
  };
  return (
    <div ref={group} role="radiogroup" aria-label={label} className={styles.group} onKeyDown={onKey}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "star" : "stars"}`} tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1} disabled={disabled} className={styles.btn} onClick={() => onChange?.(n)}>
          <Star on={n <= value} size={size} />
        </button>
      ))}
    </div>
  );
}
