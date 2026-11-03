import Link from "next/link";
import styles from "./Logo.module.css";

/** CSS-drawn logo (handoff: `Logo` component). `dark` = white wordmark for dark backgrounds. */
export function Logo({ dark, size = 22, href }: { dark?: boolean; size?: number; href?: string }) {
  const mark = (
    <span className={styles.logo} style={{ fontSize: size, color: dark ? "#fff" : "var(--prussian-blue)" }}>
      <span className={styles.mark} style={{ width: size + 8, height: size + 8 }} aria-hidden="true">
        <span className={styles.play} style={{ borderLeftWidth: size * 0.38, borderTopWidth: size * 0.24, borderBottomWidth: size * 0.24 }} />
      </span>
      <span>Mock<span className={styles.two}>2</span>Pitch</span>
    </span>
  );
  // As a link, the whole logo goes home (dashboard when signed in, landing page otherwise: callers pass the right href).
  return href ? <Link href={href} aria-label="Mock2Pitch home" className={styles.link}>{mark}</Link> : mark;
}
