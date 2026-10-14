import { Icon } from "./Icon";
import styles from "./RecordButton.module.css";

export type RecordButtonProps = { recording?: boolean; onToggle?: () => void; size?: number; disabled?: boolean };

export function RecordButton({ recording, onToggle, size = 88, disabled }: RecordButtonProps) {
  return (
    <button type="button" onClick={onToggle} disabled={disabled} aria-pressed={!!recording} aria-label={recording ? "Stop recording" : "Start recording"} className={`${styles.rb} ${recording ? styles.rec : ""}`} style={{ width: size, height: size }}>
      {recording ? <span style={{ width: size * 0.3, height: size * 0.3, borderRadius: 6, background: "var(--white)" }} /> : <Icon name="mic" size={Math.round(size * 0.38)} />}
    </button>
  );
}
