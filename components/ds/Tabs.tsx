"use client";
import { useId, useRef, type KeyboardEvent } from "react";
import styles from "./Tabs.module.css";

export type TabItem = string | { value: string; label: string };
export type TabsProps = { items: readonly TabItem[]; value: string; onChange?: (v: string) => void; variant?: "segmented" | "underline" | "pill"; label?: string };

/** Tab list with roving focus (←/→/Home/End). `pill` is the outlined pill style used on Terms, Ratings filters and the admin editor. */
export function Tabs({ items, value, onChange, variant = "segmented", label = "Tabs" }: TabsProps) {
  const list = useRef<HTMLDivElement>(null);
  const base = useId();
  const norm = items.map((it) => (typeof it === "string" ? { value: it, label: it } : it));
  const onKey = (e: KeyboardEvent) => {
    const i = norm.findIndex((x) => x.value === value);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % norm.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + norm.length) % norm.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = norm.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange?.(norm[n]!.value);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[n]?.focus();
  };
  return (
    <div ref={list} role="tablist" aria-label={label} className={`${styles.list} ${styles[variant]}`} onKeyDown={onKey}>
      {norm.map((it) => {
        const on = it.value === value;
        return <button key={it.value} id={`${base}-${it.value}`} role="tab" type="button" aria-selected={on} tabIndex={on ? 0 : -1} className={`${styles.tab} ${on ? styles.on : ""}`} onClick={() => onChange?.(it.value)}>{it.label}</button>;
      })}
    </div>
  );
}
