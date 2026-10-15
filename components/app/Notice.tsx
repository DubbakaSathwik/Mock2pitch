import type { ReactNode } from "react";
import { Icon } from "@/components/ds/Icon";
import { Button } from "@/components/ds/Button";
import { Muted } from "./Typography";
import styles from "./Notice.module.css";

type Tone = "danger" | "warning" | "info";

/** Inline message box: danger (errors), warning (e.g. missing slides) or info. Always announced to screen readers. */
export function Notice({ tone = "danger", title, children, action }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode }) {
  const color = tone === "danger" ? "var(--danger-500)" : tone === "warning" ? "var(--warning-500)" : "var(--bright-marine)";
  const titleColor = tone === "danger" ? "var(--danger-text)" : tone === "warning" ? "var(--warning-text)" : "var(--marine-600)";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`${styles.n} ${styles[tone]}`}>
      <Icon name={tone === "info" ? "info" : "triangle-alert"} size={20} color={color} />
      <div className={styles.body}>
        {title && <div className={styles.title} style={{ color: titleColor }}>{title}</div>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** A mapped backend error (features/errors/map.ts) as a Notice, with an optional Try again button. */
export function ErrorNotice({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <Notice tone="danger" title={title} action={onRetry ? <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button> : undefined}>
      <Muted as="span" style={{ color: "var(--ink-700)" }}>{body}</Muted>
    </Notice>
  );
}
