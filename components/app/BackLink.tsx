import Link from "next/link";
import { Icon } from "@/components/ds/Icon";
import styles from "./BackLink.module.css";

/** "‹ Back" link to the previous step. `label` names the destination for screen readers and keeps the visible text short. */
export function BackLink({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link href={href} className={styles.back} data-testid="back-link">
      <Icon name="chevron-left" size={18} />
      <span>{label}</span>
    </Link>
  );
}
