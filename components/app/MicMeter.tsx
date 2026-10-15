import styles from "./MicMeter.module.css";

export const METER_BARS = 28;

/** 28-bar input meter (mic check). Bars light up with the live level; the last few turn amber when the input is loud. */
export function MicMeter({ level }: { level: number }) {
  return (
    <div className={styles.meter} aria-hidden="true" data-testid="mic-meter">
      {Array.from({ length: METER_BARS }, (_, k) => {
        const on = k / METER_BARS < level;
        return <div key={k} className={`${styles.bar} ${on ? (k > 22 ? styles.loud : styles.on) : ""}`} style={{ height: 8 + (k % 6) * 6 + 12 }} data-on={on ? "1" : "0"} />;
      })}
    </div>
  );
}

export const levelLabel = (l: number) => (l > 0.75 ? "a little loud" : l > 0.3 ? "good" : "speak up a little");
