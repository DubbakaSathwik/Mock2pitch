import { Icon } from "@/components/ds/Icon";
import { Avatar } from "./Avatar";
import styles from "./Person.module.css";

const TONES: [string, string][] = [["#16336f", "#d9a98a"], ["#0c2a5e", "#c68e6b"], ["#1d3f86", "#e8bfa3"], ["#0f2457", "#b97f5d"], ["#23458f", "#f0cdb4"]];

export type JuryMember = { name: string; role: string };
export const JURY: JuryMember[] = [
  { name: "Prof. Mehta", role: "Jury" }, { name: "Ms. Iyer", role: "Jury" }, { name: "Rohan K.", role: "Audience" }, { name: "Dr. Fernandes", role: "Jury" }, { name: "Sana", role: "Mentor" },
];

/** Animated, silent jury tile (decorative). Nod/blink stop under prefers-reduced-motion. */
export function Person({ k, label, role, small }: { k: number; label: string; role: string; small?: boolean }) {
  const [bg, skin] = TONES[k % TONES.length]!;
  return (
    <div className={styles.tile} style={{ background: `linear-gradient(160deg, ${bg}, #001C55)` }} data-testid="jury-tile">
      <svg viewBox="0 0 120 90" className={styles.svg} aria-hidden="true">
        <g className={styles.nod} style={{ ["--d" as string]: `${6 + k * 1.3}s`, ["--delay" as string]: `${k * 0.7}s` }}>
          <path d="M18 92c0-22 18-30 42-30s42 8 42 30z" fill={k % 2 ? "#e7ecf7" : "#20356b"} opacity=".92" />
          <rect x="52" y="50" width="16" height="14" rx="6" fill={skin} />
          <ellipse cx="60" cy="40" rx="17" ry="19" fill={skin} />
          <path d={k % 2 ? "M42 38c0-14 8-20 18-20s18 6 18 20c-4-8-10-11-18-11s-14 3-18 11z" : "M43 34c2-12 9-17 17-17s15 5 17 17c-7-5-12-6-17-6s-10 1-17 6z"} fill="#1b1410" />
          <g className={styles.blink} style={{ ["--d" as string]: `${4 + k * 0.9}s`, ["--delay" as string]: `${k * 1.1}s` }}>
            <circle cx="53" cy="41" r="2" fill="#1b1410" /><circle cx="67" cy="41" r="2" fill="#1b1410" />
          </g>
          <path d="M55 49q5 3 10 0" stroke="#7a3d2c" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      <div className={`${styles.label} ${small ? styles.labelSm : ""}`}>{label}{!small && <span className={styles.role}> · {role}</span>}</div>
      {!small && <div className={styles.mute}><Icon name="mic-off" size={11} /></div>}
    </div>
  );
}

/** The student's own tile; the glow ring scales with the live microphone level (0–1). */
export function SelfTile({ name, avatarUrl, speaking, small, level }: { name: string; avatarUrl?: string | null; speaking?: boolean; small?: boolean; level: number }) {
  const sz = small ? 34 : 52;
  return (
    <div className={styles.self} style={{ border: speaking ? "2px solid var(--icy-blue)" : "2px solid transparent" }} data-testid="self-tile" data-speaking={speaking ? "true" : "false"}>
      <div style={{ borderRadius: "50%", boxShadow: speaking ? `0 0 0 ${3 + level * 12}px rgba(166,225,250,.28), 0 0 0 ${1 + level * 5}px rgba(166,225,250,.7)` : "none", transition: "box-shadow .12s" }}>
        <Avatar name={name} src={avatarUrl} size={sz} bg="#A6E1FA" fg="#00072D" />
      </div>
      <div className={`${styles.label} ${small ? styles.labelSm : ""}`}>You</div>
      {!small && <div className={styles.mute} style={{ background: speaking ? "var(--success-500)" : undefined }}><Icon name={speaking ? "mic" : "mic-off"} size={11} /></div>}
    </div>
  );
}
