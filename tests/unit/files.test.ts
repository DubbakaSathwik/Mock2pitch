import { describe, expect, it } from "vitest";
import { buildWav, isJpegSignature, isPdfSignature, normaliseFilename, parseWav, titleFromFilename } from "@shared/files.ts";

const pcm = (secs: number) => new Uint8Array(16000 * 2 * secs);

function wavWith(rate: number, ch: number, bits: number, fmtTag = 1, data = pcm(1)) {
  const w = buildWav(data);
  const dv = new DataView(w.buffer);
  dv.setUint16(20, fmtTag, true); dv.setUint16(22, ch, true); dv.setUint32(24, rate, true); dv.setUint16(34, bits, true);
  return w;
}

describe("parseWav", () => {
  it("accepts 16k mono 16-bit and computes duration from data", () => {
    const r = parseWav(buildWav(pcm(3)));
    expect(r).toMatchObject({ ok: true, durationMs: 3000, dataOffset: 44, dataBytes: 96000 });
  });
  it("rejects stereo, 44.1k, 8-bit, non-PCM, not RIFF, short", () => {
    expect(parseWav(wavWith(16000, 2, 16))).toEqual({ ok: false, reason: "not_mono" });
    expect(parseWav(wavWith(44100, 1, 16))).toEqual({ ok: false, reason: "bad_sample_rate" });
    expect(parseWav(wavWith(16000, 1, 8))).toEqual({ ok: false, reason: "bad_bit_depth" });
    expect(parseWav(wavWith(16000, 1, 16, 3))).toEqual({ ok: false, reason: "not_pcm" });
    expect(parseWav(new TextEncoder().encode("x".repeat(100)))).toEqual({ ok: false, reason: "not_riff_wave" });
    expect(parseWav(new Uint8Array(10))).toEqual({ ok: false, reason: "too_short" });
  });
  it("ignores a lying client size: duration comes from bytes present, and skips extra chunks", () => {
    const base = buildWav(pcm(2));
    const dv = new DataView(base.buffer);
    dv.setUint32(40, 0xffffffff, true); // streaming encoder
    expect(parseWav(base)).toMatchObject({ ok: true, durationMs: 2000 });
    // LIST chunk before data
    const list = new Uint8Array([...new TextEncoder().encode("LIST"), 4, 0, 0, 0, 1, 2, 3, 4]);
    const merged = new Uint8Array(base.length + list.length);
    merged.set(base.subarray(0, 36)); merged.set(list, 36);
    const data = base.subarray(36); merged.set(data, 36 + list.length);
    expect(parseWav(merged)).toMatchObject({ ok: true, durationMs: 2000 });
  });
  it("silence is a valid, empty-audio clip", () => expect(parseWav(buildWav(new Uint8Array(0)))).toMatchObject({ ok: true, durationMs: 0 }));
});

describe("signatures", () => {
  it("pdf/jpeg", () => {
    expect(isPdfSignature(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(isPdfSignature(new TextEncoder().encode("PK\x03\x04"))).toBe(false);
    expect(isJpegSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(isJpegSignature(new Uint8Array([0x89, 0x50, 0x4e]))).toBe(false);
  });
});

describe("filenames", () => {
  it("strips paths and control chars", () => {
    expect(normaliseFilename("../../etc/passwd")).toBe("passwd");
    expect(normaliseFilename("C:\\a\\b\\deck.pdf")).toBe("deck.pdf");
    expect(normaliseFilename("de\u0000ck\n.pdf")).toBe("deck.pdf");
    expect(normaliseFilename("a".repeat(300) + ".pdf").length).toBe(200);
    expect(normaliseFilename("a".repeat(300) + ".pdf").endsWith(".pdf")).toBe(true);
  });
  it("derives a title", () => {
    expect(titleFromFilename("ParkSense Final.PDF")).toBe("ParkSense Final");
    expect(titleFromFilename("...")).toBe("Untitled deck");
  });
});
