import styles from "./Loading.module.css";

/** Neutral shell shown while guards resolve — never any protected content. */
export function LoadingShell({ label = "Loading" }: { label?: string }) {
  return (
    <div className={styles.shell} role="status" aria-live="polite" aria-busy="true" data-testid="loading-shell">
      <span className={styles.spinner} aria-hidden="true" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function Skeleton({ h = 16, w = "100%", r = 8, style }: { h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={styles.skel} style={{ height: h, width: w, borderRadius: r, ...style }} />;
}
