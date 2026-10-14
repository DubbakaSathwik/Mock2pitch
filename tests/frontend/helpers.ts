import { PDFDocument, StandardFonts } from "pdf-lib";
import { encodeWav } from "@/features/recording/wav";

/** A real multi-page PDF with a title and three bullet lines per page. */
export async function makePdf(pages: number, opts: { title?: (i: number) => string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([960, 540]);
    p.drawText(opts.title?.(i) ?? `Slide ${i + 1} title`, { x: 60, y: 460, size: 36, font });
    ["First point on the slide", "Second point on the slide", "Third point on the slide"].forEach((t, k) => p.drawText(t, { x: 60, y: 400 - k * 40, size: 20, font }));
  }
  return doc.save();
}

/** A speech-like 16 kHz mono WAV of `seconds` (sine tone with an envelope). */
export function makeWav(seconds: number): Uint8Array {
  const n = Math.round(16000 * seconds);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) s[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / 16000) * (0.6 + 0.4 * Math.sin(i / 2000));
  return encodeWav(s);
}

export const blobOf = (b: Uint8Array, type: string) => new Blob([b as BlobPart], { type });
