import type { CSSProperties } from "react";

export type ScoreRingProps = { value?: number; size?: number; stroke?: number; label?: string | null; color?: string; track?: string; textColor?: string; style?: CSSProperties };

export function ScoreRing({ value = 0, size = 140, stroke = 12, label = "Confidence", color = "var(--bright-marine)", track = "var(--ink-100)", textColor = "var(--text-strong)", style }: ScoreRingProps) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <div role="img" aria-label={`Score ${value}${label ? ` ${label}` : ""}`} style={{ position: "relative", width: size, height: size, flexShrink: 0, ...style }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset var(--dur-slow) var(--ease-out)" }} />
      </svg>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: size * 0.28, lineHeight: 1, color: textColor }}>{value}</span>
        {label && <span style={{ fontFamily: "var(--font-body)", fontSize: Math.max(11, size * 0.095), color: textColor, opacity: 0.75, marginTop: 4 }}>{label}</span>}
      </div>
    </div>
  );
}
