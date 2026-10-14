// Presentation rules for scores (design handoff §7) and filler highlighting. Scoring itself lives server-side (_shared/scoring.ts).
import { FILLER_REGEX_SOURCE } from "@shared/constants.ts";

/** ≥ 75 success, ≥ 60 marine, otherwise warning. */
export function scoreBand(v: number): "success" | "marine" | "warning" {
  return v >= 75 ? "success" : v >= 60 ? "marine" : "warning";
}
export const SCORE_COLOR = { success: "var(--success-500)", marine: "var(--bright-marine)", warning: "var(--warning-500)" } as const;
export const scoreColor = (v: number) => SCORE_COLOR[scoreBand(v)];
export const SCORE_WORD = { success: "Strong", marine: "Good", warning: "Needs work" } as const;

export type TextPart = { text: string; filler: boolean };

/** Splits a transcript into plain and filler parts (React nodes are built from this; no HTML is ever injected). */
export function splitFillers(text: string): TextPart[] {
  const re = new RegExp(FILLER_REGEX_SOURCE, "gi");
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i), filler: false });
    parts.push({ text: m[0], filler: true });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), filler: false });
  return parts;
}
