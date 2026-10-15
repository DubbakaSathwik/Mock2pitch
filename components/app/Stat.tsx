import { Card } from "@/components/ds/Card";
import type { IconName } from "@/components/ds/Icon";
import { Tile } from "./Tile";
import { Muted } from "./Typography";
import styles from "./Stat.module.css";

export function Stat({ icon, label, value, sub }: { icon: IconName; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card padding={20} as="section" aria-label={label}>
      <div className={styles.top}><Tile icon={icon} size={36} /><Muted as="span">{label}</Muted></div>
      <div className={styles.value}>{value}</div>
      {sub && <Muted style={{ fontSize: 12 }}>{sub}</Muted>}
    </Card>
  );
}
