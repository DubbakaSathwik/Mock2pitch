// Version-label helpers for the Terms editor ("v3.0" → next "v4.0"; the label must sort after the live one — same rule as admin_publish_policy).
export function parseLabel(label: string): [number, number] | null {
  const m = /^v(\d+)(?:\.(\d+))?$/.exec(label.trim());
  return m ? [Number(m[1]), Number(m[2] ?? 0)] : null;
}
export function compareLabels(a: string, b: string): number {
  const x = parseLabel(a), y = parseLabel(b);
  if (!x || !y) return 0;
  return x[0] - y[0] || x[1] - y[1];
}
export function nextLabel(current: string): string {
  const p = parseLabel(current);
  return p ? `v${p[0] + 1}.0` : "v1.0";
}
/** Empty string = valid. */
export function validateLabel(label: string, current: string): string {
  if (!parseLabel(label)) return "Use a label like v4.0";
  if (compareLabels(label, current) <= 0) return `The label must come after ${current}`;
  return "";
}
