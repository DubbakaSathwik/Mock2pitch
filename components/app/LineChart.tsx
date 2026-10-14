export type LinePoint = { label: string; value: number };

/** SVG score trend. The y-range is 40–100 as designed and extends downward only if a score is below 40. */
export function LineChart({ data, h = 170, color = "var(--bright-marine)", ariaLabel = "Score trend", maxLabels = 8 }: { data: LinePoint[]; h?: number; color?: string; ariaLabel?: string; maxLabels?: number }) {
  const W = 420, pad = 34;
  const min = Math.min(...data.map((d) => d.value), 100);
  const lo = Math.min(40, Math.floor(min / 20) * 20);
  const grid: number[] = [];
  for (let g = lo; g <= 100; g += 20) grid.push(g);
  const ys = (v: number) => 14 + (h - 40) * (1 - (Math.max(lo, v) - lo) / (100 - lo));
  const xs = (k: number) => (data.length === 1 ? W / 2 : pad + ((W - pad - 16) * k) / (data.length - 1));
  const step = Math.ceil(data.length / maxLabels);
  const summary = `${ariaLabel}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} role="img" aria-label={summary} style={{ width: "100%", height: "auto", display: "block" }}>
      {grid.map((g) => (
        <g key={g}>
          <line x1={pad} x2={W - 8} y1={ys(g)} y2={ys(g)} stroke="var(--ink-100)" />
          <text x={0} y={ys(g) + 4} fontSize="11" fill="var(--text-muted)" fontFamily="var(--font-body)">{g}</text>
        </g>
      ))}
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={data.map((d, k) => `${xs(k)},${ys(d.value)}`).join(" ")} />
      {data.map((d, k) => (
        <g key={k}>
          <circle cx={xs(k)} cy={ys(d.value)} r="6" fill="#fff" stroke={color} strokeWidth="3" />
          <text x={xs(k)} y={ys(d.value) - 12} fontSize="13" textAnchor="middle" fill="var(--prussian-blue)" fontFamily="var(--font-display)">{d.value}</text>
          {(k % step === 0 || k === data.length - 1) && <text x={xs(k)} y={h - 6} fontSize="11" textAnchor="middle" fill="var(--text-muted)" fontFamily="var(--font-body)">{d.label}</text>}
        </g>
      ))}
    </svg>
  );
}
