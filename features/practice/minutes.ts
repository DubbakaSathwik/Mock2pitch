import { MAX_TOTAL_MINUTES, MIN_TOTAL_MINUTES } from "@shared/constants.ts";

/** Exact copy from the design: "Enter at least 1 minute" / "The maximum is 20 minutes". Empty string = valid. */
export function validateMinutes(raw: string): string {
  const t = raw.trim();
  const n = Number(t);
  if (t === "" || Number.isNaN(n) || n < MIN_TOTAL_MINUTES) return `Enter at least ${MIN_TOTAL_MINUTES} minute`;
  if (n > MAX_TOTAL_MINUTES) return `The maximum is ${MAX_TOTAL_MINUTES} minutes`;
  if (!Number.isInteger(n)) return "Enter a whole number of minutes";
  return "";
}
