"use client";
import { useId, useState, type ReactNode } from "react";
import styles from "./Tooltip.module.css";

export function Tooltip({ content, placement = "top", children }: { content: string; placement?: "top" | "bottom"; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className={styles.wrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className={`${styles.tip} ${placement === "bottom" ? styles.bottom : styles.top} ${open ? styles.open : ""}`}>{content}</span>
    </span>
  );
}
