// Zod schemas: Edge Function inputs (strict: unknown fields rejected) and AI outputs.
import { z } from "zod";
import { MAX_CLIP_BYTES, MAX_PDF_BYTES, MAX_SLIDES } from "./constants.ts";

const uuid = z.string().uuid();
const slideIndex = z.number().int().min(0).max(MAX_SLIDES - 1);

export const deckUploadInitIn = z.object({
  filename: z.string().min(1).max(500),
  size_bytes: z.number().int().positive().max(MAX_PDF_BYTES * 4), // range-checked in handler for a precise 413
  content_type: z.string().min(1).max(100),
}).strict();

export const deckIdIn = z.object({ deck_id: uuid }).strict();

export const assetUrlsIn = z.object({
  deck_id: uuid,
  kinds: z.array(z.enum(["slide_image", "deck_pdf"])).min(1).max(2),
}).strict();

export const sessionSubmitInitIn = z.object({
  session_id: uuid,
  clips: z.array(z.object({ slide_index: slideIndex, size_bytes: z.number().int().positive().max(MAX_CLIP_BYTES * 2) }).strict()).min(1).max(MAX_SLIDES),
}).strict();

export const sessionIdIn = z.object({ session_id: uuid }).strict();
export const accountDeleteIn = z.object({ confirm: z.literal("DELETE") }).strict();

// ---- AI outputs (untrusted; validated, clamped, length-limited) ----
const clampInt = (lo: number, hi: number) =>
  z.coerce.number().transform((n) => Math.min(hi, Math.max(lo, Math.round(n))));

// Smaller vision models often drop or null optional text fields: those default to "" / 10. Key points stay mandatory.
const lenientText = (max: number, trim = true) => z.string().nullish().transform((s) => { const v = (s ?? ""); return (trim ? v.trim() : v).slice(0, max); });
export const slideReadingOut = z.object({
  title: lenientText(120),
  slide_text: lenientText(4000, false),
  key_points: z.array(z.union([z.string(), z.object({ point: z.string() }).transform((o) => o.point)]).transform((s) => s.trim().slice(0, 200)).pipe(z.string().min(1))).min(1).transform((a) => a.slice(0, 5)),
  suggested_script: lenientText(1500),
  time_weight: z.coerce.number().nullish().transform((n) => Math.min(100, Math.max(1, Math.round(Number.isFinite(n as number) ? (n as number) : 10)))),
});
export type SlideReadingOut = z.infer<typeof slideReadingOut>;

export const BLANK_SLIDE: SlideReadingOut = {
  title: "", slide_text: "", key_points: ["Introduce this slide"], suggested_script: "", time_weight: 10,
};

export const reportOut = z.object({
  slides: z.array(z.object({
    slide_index: z.coerce.number().int(),
    key_points_covered: z.array(z.coerce.number().int()).default([]),
    key_points_missed: z.array(z.coerce.number().int()).default([]),
    off_topic_quotes: z.array(z.string()).default([]),
    feedback: z.string().optional().transform((s) => (s ? s.trim().slice(0, 200) : undefined)),
  })),
  clarity_score: clampInt(0, 100),
  headline: z.string().min(1).transform((s) => s.trim().slice(0, 140)),
  top_fixes: z.array(z.string().transform((s) => s.trim().slice(0, 200))).length(3),
  did_well: z.array(z.string().transform((s) => s.trim().slice(0, 200))).length(3),
});
export type ReportOut = z.infer<typeof reportOut>;

/** Drop invalid key-point indexes and quotes that are not exact substrings of the transcript (prompt-injection / hallucination guard). */
export function sanitiseSlideReport(
  s: ReportOut["slides"][number], keyPointCount: number, transcript: string,
) {
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < keyPointCount;
  const covered = [...new Set(s.key_points_covered.filter(valid))];
  const coveredSet = new Set(covered);
  const missed: number[] = [];
  for (let i = 0; i < keyPointCount; i++) if (!coveredSet.has(i)) missed.push(i); // missed = everything not covered (authoritative)
  const quotes = s.off_topic_quotes.map((q) => q.trim()).filter((q) => q.length > 0 && transcript.includes(q)).slice(0, 3);
  return { slide_index: s.slide_index, covered, missed, quotes, feedback: s.feedback };
}
