import type { CSSProperties, ElementType, ReactNode } from "react";
import styles from "./Typography.module.css";

type Common = { children?: ReactNode; style?: CSSProperties; className?: string; id?: string };

export function Overline({ children, color, style, className, as: Tag = "div" }: Common & { color?: string; as?: ElementType }) {
  return <Tag className={[styles.overline, className ?? ""].join(" ").trim()} style={{ color, ...style }}>{children}</Tag>;
}
/** `l` is the visual level (1 = page title 32px, 2 = section 24px, 3 = card title 19px); `as` the semantic element. */
export function H({ l = 1, as, children, style, className, id }: Common & { l?: 1 | 2 | 3; as?: ElementType }) {
  // level 3 is a *visual* size for card titles; semantically they are second-level sections under the page title (no skipped levels)
  const Tag = (as ?? ((l === 3 ? "h2" : `h${l}`) as ElementType));
  return <Tag id={id} className={[styles.h, styles[`h${l}`], className ?? ""].join(" ").trim()} style={style}>{children}</Tag>;
}
export function P({ children, style, className, id }: Common) {
  return <p id={id} className={[styles.p, className ?? ""].join(" ").trim()} style={style}>{children}</p>;
}
export function Muted({ children, style, className, as: Tag = "p", id }: Common & { as?: ElementType }) {
  return <Tag id={id} className={[styles.muted, className ?? ""].join(" ").trim()} style={style}>{children}</Tag>;
}
