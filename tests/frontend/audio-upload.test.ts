import { describe, expect, it, vi } from "vitest";
import { MAX_CLIP_BYTES, SLIDE_IMAGE_JPEG_QUALITY, SLIDE_IMAGE_MAX_BYTES, SLIDE_IMAGE_MAX_WIDTH, SLIDE_IMAGE_MIN_JPEG_QUALITY, SLIDE_IMAGE_MIN_WIDTH } from "@shared/constants.ts";
import { parseWav } from "@shared/files.ts";
import { downmixToMono, encodeWav, resampleLinear, wavDurationMs } from "@/features/recording/wav";
import { MAX_CLIP_SECONDS, MAX_CLIP_WAV_BYTES, classifyMicError, levelFromTimeDomain } from "@/features/recording/recorder";
import { detectCapabilities, isChromiumUserAgent, pickMimeType, recordingSupported } from "@/features/recording/capabilities";
import { encodeAttempts, encodeUntilFits } from "@/features/upload/jpeg-rules";
import { putToSignedUrl, registerMockPutTransport, sendableHeaders } from "@/lib/upload/put";
import { validateMinutes } from "@/features/practice/minutes";
import type { SlideImageRules } from "@/lib/data/types";

describe("WAV encoder (16 kHz mono 16-bit PCM)", () => {
  it("writes a correct RIFF header and exact byte length", () => {
    const wav = encodeWav(new Float32Array(16000)); // 1 s
    const v = new DataView(wav.buffer);
    const tag = (o: number) => String.fromCharCode(wav[o]!, wav[o + 1]!, wav[o + 2]!, wav[o + 3]!);
    expect(tag(0)).toBe("RIFF"); expect(tag(8)).toBe("WAVE"); expect(tag(12)).toBe("fmt "); expect(tag(36)).toBe("data");
    expect(wav.length).toBe(44 + 32000);
    expect(v.getUint32(4, true)).toBe(36 + 32000);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000); // byte rate
    expect(v.getUint16(32, true)).toBe(2); // block align
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(32000);
    expect(wavDurationMs(wav)).toBe(1000);
  });
  it("is accepted by the Phase 1 server-side WAV checker", () => {
    const wav = encodeWav(new Float32Array(48000));
    const info = parseWav(wav, wav.length);
    expect(info.ok).toBe(true);
    if (info.ok) expect(info.durationMs).toBe(3000);
  });
  it("clips samples to the 16-bit range and keeps sign", () => {
    const wav = encodeWav(Float32Array.from([1, -1, 2, -2, 0, 0.5]));
    const v = new DataView(wav.buffer);
    expect([0, 1, 2, 3, 4, 5].map((i) => v.getInt16(44 + i * 2, true))).toEqual([32767, -32768, 32767, -32768, 0, 16384]);
  });
  it("downmixes to mono and resamples", () => {
    expect(Array.from(downmixToMono([Float32Array.from([1, 0]), Float32Array.from([0, 1])]))).toEqual([0.5, 0.5]);
    const r = resampleLinear(new Float32Array(48000).fill(0.2), 48000, 16000);
    expect(r.length).toBe(16000);
    expect(r[100]).toBeCloseTo(0.2, 5);
    expect(resampleLinear(Float32Array.from([1, 2, 3]), 16000, 16000)).toHaveLength(3);
  });
  it("keeps the 10:00 recording cap under the server's per-clip limit", () => {
    expect(MAX_CLIP_SECONDS).toBe(600);
    expect(MAX_CLIP_WAV_BYTES).toBe(44 + 600 * 32000);
    expect(MAX_CLIP_WAV_BYTES).toBeLessThanOrEqual(MAX_CLIP_BYTES);
  });
});

describe("recorder helpers", () => {
  it("picks webm/opus on Chromium and mp4/aac on Safari", () => {
    expect(pickMimeType((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(pickMimeType((t) => t.startsWith("audio/mp4"))).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(pickMimeType((t) => t === "audio/aac")).toBe("audio/aac");
    expect(pickMimeType(() => false)).toBeUndefined();
  });
  it("classifies getUserMedia failures", () => {
    expect(classifyMicError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyMicError({ name: "SecurityError" })).toBe("denied");
    expect(classifyMicError({ name: "NotFoundError" })).toBe("no_device");
    expect(classifyMicError({ name: "NotReadableError" })).toBe("busy");
    expect(classifyMicError({ name: "TypeError" })).toBe("unsupported");
    expect(classifyMicError(new Error("x"))).toBe("unknown");
  });
  it("derives a 0–1 level from time-domain samples", () => {
    expect(levelFromTimeDomain(new Uint8Array(256).fill(128))).toBe(0);
    expect(levelFromTimeDomain(Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 255 : 0)))).toBe(1);
    const mid = levelFromTimeDomain(Uint8Array.from({ length: 256 }, (_, i) => 128 + (i % 2 ? 20 : -20)));
    expect(mid).toBeGreaterThan(0.1); expect(mid).toBeLessThan(1);
    expect(levelFromTimeDomain(new Uint8Array(0))).toBe(0);
  });
  it("detects Chromium and capabilities", () => {
    expect(isChromiumUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")).toBe(true);
    expect(isChromiumUserAgent("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15")).toBe(false);
    expect(isChromiumUserAgent("Mozilla/5.0 (Macintosh; rv:128.0) Gecko/20100101 Firefox/128.0")).toBe(false);
    expect(isChromiumUserAgent("Mozilla/5.0 (iPhone) AppleWebKit/605 (KHTML, like Gecko) CriOS/130 Mobile/15E148 Safari/604.1")).toBe(false);
    const full = detectCapabilities({ navigator: { mediaDevices: { getUserMedia: () => {} }, userAgent: "Chrome/141" } as never, w: { MediaRecorder: function MR() {}, AudioContext: function AC() {}, OfflineAudioContext: function OC() {} } });
    expect(full).toMatchObject({ getUserMedia: true, mediaRecorder: true, audioContext: true, offlineAudioContext: true, chromium: true });
    expect(recordingSupported(full)).toBe(true);
    expect(recordingSupported(detectCapabilities({ navigator: { userAgent: "" } as never, w: {} }))).toBe(false);
  });
});

const RULES: SlideImageRules = { max_width: SLIDE_IMAGE_MAX_WIDTH, min_width: SLIDE_IMAGE_MIN_WIDTH, jpeg_quality: SLIDE_IMAGE_JPEG_QUALITY, min_jpeg_quality: SLIDE_IMAGE_MIN_JPEG_QUALITY, max_bytes: SLIDE_IMAGE_MAX_BYTES, content_type: "image/jpeg" };

describe("slide-image rule stepping", () => {
  it("lowers quality first (0.8 → 0.5) at full width, then lowers the width to the minimum", () => {
    const a = encodeAttempts(RULES);
    expect(a.slice(0, 4)).toEqual([{ width: 1280, quality: 0.8 }, { width: 1280, quality: 0.7 }, { width: 1280, quality: 0.6 }, { width: 1280, quality: 0.5 }]);
    const widths = a.slice(4).map((x) => x.width);
    expect(widths.every((w, i) => i === 0 || w < widths[i - 1]!)).toBe(true);
    expect(a.slice(4).every((x) => x.quality === 0.5)).toBe(true);
    expect(a.at(-1)!.width).toBe(800);
    expect(a.every((x) => x.width >= 800 && x.width <= 1280)).toBe(true);
  });
  it("stops at the first attempt that fits max_bytes", async () => {
    const calls: unknown[] = [];
    const r = await encodeUntilFits(RULES, async (at) => { calls.push(at); const size = Math.round(at.width * at.width * at.quality * 0.9); return { blob: at, size }; });
    expect(r.fits).toBe(true);
    expect(r.size).toBeLessThanOrEqual(SLIDE_IMAGE_MAX_BYTES);
    expect(r.tries).toBe(calls.length);
    expect(calls.length).toBeGreaterThan(1);
  });
  it("returns the smallest attempt when nothing fits (the server will reply image_too_large)", async () => {
    const r = await encodeUntilFits(RULES, async () => ({ blob: 1, size: 5_000_000 }));
    expect(r.fits).toBe(false);
    expect(r.attempt).toEqual({ width: 800, quality: 0.5 });
  });
  it("accepts the first render when it already fits", async () => {
    const r = await encodeUntilFits(RULES, async () => ({ blob: 1, size: 120_000 }));
    expect(r).toMatchObject({ fits: true, tries: 1, attempt: { width: 1280, quality: 0.8 } });
  });
});

describe("presigned PUT helper", () => {
  it("never sends Content-Length (the browser sets it from the body)", () => {
    expect(sendableHeaders({ "Content-Type": "audio/wav", "Content-Length": "96044", "content-length": "1" })).toEqual({ "Content-Type": "audio/wav" });
  });
  it("routes mock:// targets through the registered transport", async () => {
    const t = vi.fn(async () => {});
    registerMockPutTransport(t);
    const body = new Blob(["abc"]);
    await putToSignedUrl({ url: "mock://put/x", headers: { "Content-Type": "x" } }, body);
    expect(t).toHaveBeenCalledOnce();
    registerMockPutTransport(null);
    await expect(putToSignedUrl({ url: "mock://put/x", headers: {} }, body)).rejects.toMatchObject({ code: "upload_failed" });
  });
});

describe("minutes validation", () => {
  it("uses the exact copy from the design", () => {
    expect(validateMinutes("")).toBe("Enter at least 1 minute");
    expect(validateMinutes("0")).toBe("Enter at least 1 minute");
    expect(validateMinutes("-3")).toBe("Enter at least 1 minute");
    expect(validateMinutes("abc")).toBe("Enter at least 1 minute");
    expect(validateMinutes("21")).toBe("The maximum is 20 minutes");
    expect(validateMinutes("2.5")).toBe("Enter a whole number of minutes");
    expect(["1", "5", "20", " 7 "].map(validateMinutes)).toEqual(["", "", "", ""]);
  });
});
