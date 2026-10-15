import type { CSSProperties } from "react";
import styles from "./ProgressBar.module.css";

export type ProgressBarProps = {
  value?: number; max?: number; tone?: "marine" | "success" | "warning" | "danger" | "navy"; height?: number;
  label?: string; valueLabel?: string; style?: CSSProperties; ariaLabel?: string;
};

export function ProgressBar({ value = 0, max = 100, tone = "marine", height = 8, label, valueLabel, style, ariaLabel }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className={styles.wrap} style={style}>
      {(label || valueLabel) && <div className={styles.row}><span>{label}</span><b>{valueLabel}</b></div>}
      <div className={styles.track} style={{ height, borderRadius: height }} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={ariaLabel ?? label ?? "Progress"} aria-valuetext={valueLabel}>
        <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${pct}%`, borderRadius: height }} />
      </div>
    </div>
  );
}
