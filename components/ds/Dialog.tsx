"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import styles from "./Dialog.module.css";

export type DialogProps = { open?: boolean; title: string; children?: ReactNode; actions?: ReactNode; onClose?: () => void; width?: number; inline?: boolean };

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Modal dialog: scrim + 4 px blur, focus trap, Esc to close, focus returns to the opener. Rendered in a portal. */
export function Dialog({ open = true, title, children, actions, onClose, width = 480, inline }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open || inline) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const first = el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (f.length === 0) { e.preventDefault(); return; }
      const a = f[0]!, z = f[f.length - 1]!;
      if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); opener?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, inline]);

  if (!open) return null;
  const body = (
    <div ref={panel} role="dialog" aria-modal={inline ? undefined : true} aria-labelledby={titleId} tabIndex={-1} className={styles.panel} style={{ width }}>
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>{title}</h3>
        {onClose && <IconButton icon="x" label="Close" size={32} onClick={onClose} />}
      </div>
      <div className={styles.body}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
  if (inline) return body;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={styles.scrim} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>{body}</div>,
    document.body,
  );
}
