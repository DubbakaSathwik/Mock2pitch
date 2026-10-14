/**
 * Div-bar chart (handoff A1/A5 spec): heights proportional to the max, baseline, x labels every `every`-th (the last label is always shown),
 * the last bar imperial, a value above the last bar (or above every bar with `values`).
 * Text alternative: an accessible summary plus a visually hidden table.
 */
export function BarChart({ data, labels, h = 160, every = 1, values, caption }: { data: number[]; labels: string[]; h?: number; every?: number; values?: boolean; caption: string }) {
  const max = Math.max(1, ...data);
  return (
    <figure style={{ margin: 0 }}>
      <div aria-hidden="true">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: h, borderBottom: "1px solid var(--ink-200)" }}>
          {data.map((v, i) => (
            <div key={i} title={`${labels[i]}: ${v}`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
              {(values || i === data.length - 1) && <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-600)" }}>{v}</span>}
              <div style={{ width: "100%", height: Math.round((v / max) * (h - 22)), background: i === data.length - 1 ? "var(--imperial-blue)" : "var(--marine-200)", borderRadius: "6px 6px 0 0" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {labels.map((l, i) => (
            <span key={i} style={{ flex: 1, minWidth: 0, textAlign: "center", fontFamily: "var(--font-body)", fontSize: 10, color: "var(--ink-500)", whiteSpace: "nowrap", visibility: i % every === (labels.length - 1) % every ? "visible" : "hidden" }}>{l}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Value</th></tr></thead>
        <tbody>{labels.map((l, i) => <tr key={i}><th scope="row">{l}</th><td>{data[i]}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
