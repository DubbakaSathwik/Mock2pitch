// Byte-level validators for uploaded files. Pure; operate on Uint8Array.
import { AUDIO_BITS, AUDIO_CHANNELS, AUDIO_SAMPLE_RATE } from "./constants.ts";

export function isPdfSignature(b: Uint8Array): boolean {
  return b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;
}
export function isJpegSignature(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

export type WavInfo = { ok: true; durationMs: number; dataOffset: number; dataBytes: number } | { ok: false; reason: string };

/** Validate RIFF/WAVE, PCM, 16 kHz, mono, 16-bit; duration derives from the data chunk (server-trusted). */
export function parseWav(b: Uint8Array, totalLength: number = b.length): WavInfo {
  if (b.length < 44) return { ok: false, reason: "too_short" };
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return { ok: false, reason: "not_riff_wave" };
  let off = 12;
  let fmt: { format: number; ch: number; rate: number; bits: number } | null = null;
  while (off + 8 <= b.length) {
    const id = tag(off);
    const size = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === "fmt ") {
      if (size < 16 || body + 16 > b.length) return { ok: false, reason: "bad_fmt" };
      fmt = { format: dv.getUint16(body, true), ch: dv.getUint16(body + 2, true), rate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
    } else if (id === "data") {
      if (!fmt) return { ok: false, reason: "data_before_fmt" };
      if (fmt.format !== 1) return { ok: false, reason: "not_pcm" };
      if (fmt.rate !== AUDIO_SAMPLE_RATE) return { ok: false, reason: "bad_sample_rate" };
      if (fmt.ch !== AUDIO_CHANNELS) return { ok: false, reason: "not_mono" };
      if (fmt.bits !== AUDIO_BITS) return { ok: false, reason: "bad_bit_depth" };
      // Streaming encoders may write 0/0xFFFFFFFF sizes; clamp to what is actually present.
      const avail = totalLength - body; // totalLength lets callers pass only the header bytes of a large object
      const dataBytes = size === 0 || size > avail ? avail : size;
      const bytesPerSec = fmt.rate * fmt.ch * (fmt.bits / 8);
      return { ok: true, durationMs: Math.round((dataBytes / bytesPerSec) * 1000), dataOffset: body, dataBytes };
    }
    off = body + size + (size % 2);
  }
  return { ok: false, reason: "no_data_chunk" };
}

/** Build a canonical 44-byte-header PCM WAV (used by chunking and tests). */
export function buildWav(pcm: Uint8Array): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const dv = new DataView(out.buffer);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  w(0, "RIFF"); dv.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, AUDIO_CHANNELS, true);
  dv.setUint32(24, AUDIO_SAMPLE_RATE, true); dv.setUint32(28, AUDIO_SAMPLE_RATE * AUDIO_CHANNELS * 2, true);
  dv.setUint16(32, AUDIO_CHANNELS * 2, true); dv.setUint16(34, AUDIO_BITS, true); w(36, "data"); dv.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** Normalise a user-supplied filename: strip paths and control chars, cap length. */
export function normaliseFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  let n = name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\\/g, "/").split("/").pop() ?? "";
  n = n.replace(/^\.+/, "").trim();
  if (n.length > 200) {
    const dot = n.lastIndexOf(".");
    const ext = dot > 0 ? n.slice(dot) : "";
    n = n.slice(0, 200 - ext.length) + ext;
  }
  return n;
}
export const titleFromFilename = (name: string) => normaliseFilename(name).replace(/\.pdf$/i, "").slice(0, 120) || "Untitled deck";
