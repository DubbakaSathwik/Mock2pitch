// Formatting helpers shared by every screen. Dates are en-IN ("6 Oct 2026"); the daily reset is expressed in IST.
export const TZ = "Asia/Kolkata";

/** Seconds → m:ss ("4:49"). */
export function mmss(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const msToSeconds = (ms: number) => ms / 1000;

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dayMonthFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });

/** "6 Oct 2026" */
export function formatDate(iso: string | Date): string {
  return dateFmt.format(typeof iso === "string" ? new Date(iso) : iso).replace(/\bSept\b/, "Sep");
}
/** "6 Oct" */
export function formatDayMonth(iso: string | Date): string {
  return dayMonthFmt.format(typeof iso === "string" ? new Date(iso) : iso).replace(/\bSept\b/, "Sep");
}
export function formatTime(iso: string | Date): string {
  return timeFmt.format(typeof iso === "string" ? new Date(iso) : iso).toUpperCase();
}

/** "Today" / "Yesterday" / "28 Sep" for last-active columns. */
export function relativeDay(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "–";
  const d = istDateString(new Date(iso));
  const today = istDateString(now);
  if (d === today) return "Today";
  const y = new Date(now.getTime() - 86_400_000);
  if (d === istDateString(y)) return "Yesterday";
  return formatDayMonth(iso);
}

/** YYYY-MM-DD of an instant in IST. */
export function istDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** The next midnight IST after `now`, as an ISO instant. IST is UTC+05:30 all year (no DST). */
export function nextIstMidnight(now = new Date()): string {
  const IST_OFFSET_MS = 5.5 * 3_600_000;
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const next = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() + 1);
  return new Date(next - IST_OFFSET_MS).toISOString();
}

/** "in about 6 hours" / "in about 40 minutes" */
export function untilReset(resetIso: string, now = new Date()): string {
  const ms = Math.max(0, new Date(resetIso).getTime() - now.getTime());
  const h = Math.round(ms / 3_600_000);
  if (h >= 2) return `in about ${h} hours`;
  const m = Math.max(1, Math.round(ms / 60_000));
  if (ms >= 3_600_000) return "in about an hour";
  return `in about ${m} ${m === 1 ? "minute" : "minutes"}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Practice time shown on the dashboard: total ms → "10:19". */
export const msToMmss = (ms: number) => mmss(ms / 1000);
