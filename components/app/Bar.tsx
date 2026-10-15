/** Thin score/weight bar used inside rows (decorative; the number beside it carries the value). */
export function Bar({ v, color = "var(--bright-marine)", h = 8 }: { v: number; color?: string; h?: number }) {
  return (
    <div aria-hidden="true" style={{ height: h, borderRadius: 99, background: "var(--ink-100)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, v))}%`, height: "100%", background: color, borderRadius: 99, transition: "width .36s var(--ease-out)" }} />
    </div>
  );
}
