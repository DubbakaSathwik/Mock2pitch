import styles from "./Logo.module.css";

/** CSS-drawn logo (handoff: `Logo` component). `dark` = white wordmark for dark backgrounds. */
export function Logo({ dark, size = 22 }: { dark?: boolean; size?: number }) {
  return (
    <span className={styles.logo} style={{ fontSize: size, color: dark ? "#fff" : "var(--prussian-blue)" }}>
      <span className={styles.mark} style={{ width: size + 8, height: size + 8 }} aria-hidden="true">
        <span className={styles.play} style={{ borderLeftWidth: size * 0.38, borderTopWidth: size * 0.24, borderBottomWidth: size * 0.24 }} />
      </span>
      <span>Mock<span className={styles.two}>2</span>Pitch</span>
    </span>
  );
}
