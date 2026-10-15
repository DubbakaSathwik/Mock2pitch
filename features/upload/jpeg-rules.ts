// Pure stepping logic for the slide-image rule returned by deck-upload-complete (`rules`):
// render at <= max_width and jpeg_quality; if the JPEG is larger than max_bytes lower the quality step by step down to
// min_jpeg_quality, then lower the width down to min_width, until the file fits.
import type { SlideImageRules } from "@/lib/data/types";

export type EncodeAttempt = { width: number; quality: number };

export const QUALITY_STEP = 0.1;
export const WIDTH_FACTOR = 0.9;

/** The full ordered list of attempts (deduplicated). Deterministic, so it is unit-tested without a canvas. */
export function encodeAttempts(rules: SlideImageRules): EncodeAttempt[] {
  const out: EncodeAttempt[] = [];
  const round2 = (n: number) => Math.round(n * 100) / 100;
  for (let q = rules.jpeg_quality; q >= rules.min_jpeg_quality - 1e-9; q = round2(q - QUALITY_STEP)) out.push({ width: rules.max_width, quality: round2(Math.max(q, rules.min_jpeg_quality)) });
  let w = rules.max_width;
  while (w > rules.min_width) {
    w = Math.max(rules.min_width, Math.round(w * WIDTH_FACTOR));
    out.push({ width: w, quality: rules.min_jpeg_quality });
  }
  return out.filter((a, i, arr) => arr.findIndex((b) => b.width === a.width && b.quality === a.quality) === i);
}

export type EncodeResult<B> = { blob: B; size: number; attempt: EncodeAttempt; fits: boolean; tries: number };

/** Encode until the output fits `max_bytes`; returns the smallest attempt even if nothing fits (the server will then say image_too_large). */
export async function encodeUntilFits<B>(rules: SlideImageRules, encode: (a: EncodeAttempt) => Promise<{ blob: B; size: number }>): Promise<EncodeResult<B>> {
  const attempts = encodeAttempts(rules);
  let last: EncodeResult<B> | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i]!;
    const { blob, size } = await encode(attempt);
    last = { blob, size, attempt, fits: size <= rules.max_bytes, tries: i + 1 };
    if (last.fits) return last;
  }
  return last!;
}
