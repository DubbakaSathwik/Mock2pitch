// Audio helpers: WAV chunking (for ASR size limits) and transcript merging.
import { AUDIO_BITS, AUDIO_CHANNELS, AUDIO_SAMPLE_RATE } from "./constants.ts";
import { buildWav, parseWav } from "./files.ts";

export type TimedWord = { w: string; start_ms: number; end_ms: number };
export type Transcript = { text: string; words: TimedWord[] };

const BYTES_PER_MS = (AUDIO_SAMPLE_RATE * AUDIO_CHANNELS * (AUDIO_BITS / 8)) / 1000; // 32

/** Raw PCM payload of a validated clip. */
export function pcmOf(wav: Uint8Array): Uint8Array {
  const info = parseWav(wav);
  if (!info.ok) throw new Error(`invalid_wav:${info.reason}`);
  return wav.subarray(info.dataOffset, info.dataOffset + info.dataBytes);
}

/** Split into <= chunkMs pieces at sample boundaries. Returns [{offsetMs, pcm}] (raw PCM). */
export function splitPcm(pcm: Uint8Array, chunkMs: number): { offsetMs: number; pcm: Uint8Array }[] {
  const bytes = Math.floor(chunkMs * BYTES_PER_MS / 2) * 2;
  if (pcm.length <= bytes) return [{ offsetMs: 0, pcm }];
  const out: { offsetMs: number; pcm: Uint8Array }[] = [];
  for (let off = 0; off < pcm.length; off += bytes) {
    out.push({ offsetMs: Math.round(off / BYTES_PER_MS), pcm: pcm.subarray(off, Math.min(off + bytes, pcm.length)) });
  }
  return out;
}

export function mergeTranscripts(parts: { offsetMs: number; t: Transcript }[]): Transcript {
  const sorted = [...parts].sort((a, b) => a.offsetMs - b.offsetMs);
  const words = sorted.flatMap((p) => p.t.words.map((w) => ({ w: w.w, start_ms: w.start_ms + p.offsetMs, end_ms: w.end_ms + p.offsetMs })));
  const text = sorted.map((p) => p.t.text.trim()).filter(Boolean).join(" ");
  return { text, words };
}

export const toWav = buildWav;
