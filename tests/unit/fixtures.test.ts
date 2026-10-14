import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { isJpegSignature, isPdfSignature, parseWav } from "@shared/files.ts";
import { pcmOf } from "@shared/audio.ts";

const f = (n: string) => new Uint8Array(fs.readFileSync(path.resolve(__dirname, "../fixtures", n)));

describe("committed fixtures behave as labelled", () => {
  it.each([["deck-3-pages.pdf", 3], ["deck-10-pages.pdf", 10], ["deck-11-pages.pdf", 11]])("%s has %i pages", async (name, n) => {
    expect(isPdfSignature(f(name))).toBe(true);
    expect((await PDFDocument.load(f(name))).getPageCount()).toBe(n);
  });
  it("encrypted / corrupt / non-PDF are rejected by the same checks the server uses", async () => {
    await expect(PDFDocument.load(f("deck-encrypted.pdf"), { ignoreEncryption: false })).rejects.toThrow(/encrypt/i);
    expect(isPdfSignature(f("not-a-pdf.pdf"))).toBe(false);
    expect(isPdfSignature(f("corrupt.pdf"))).toBe(true); // signature passes; parsing is the second gate
    const pages = await PDFDocument.load(f("corrupt.pdf"), { throwOnInvalidObject: false }).then((d) => d.getPageCount()).catch(() => -1);
    expect(pages <= 0).toBe(true);
  });
  it("JPEG signature check", () => {
    for (const n of ["slide-1.jpg", "slide-2.jpg", "slide-3.jpg"]) expect(isJpegSignature(f(n))).toBe(true);
    expect(isJpegSignature(f("not-a-jpeg.jpg"))).toBe(false);
  });
  it("WAV validation", () => {
    expect(parseWav(f("clip-valid-3s.wav"))).toMatchObject({ ok: true, durationMs: 3000 });
    expect(parseWav(f("clip-silent-3s.wav"))).toMatchObject({ ok: true, durationMs: 3000 });
    expect(pcmOf(f("clip-silent-3s.wav")).every((b) => b === 0)).toBe(true);
    expect(parseWav(f("clip-fillers-synthetic.wav"))).toMatchObject({ ok: true });
    expect(parseWav(f("clip-invalid-stereo.wav"))).toEqual({ ok: false, reason: "not_mono" });
    expect(parseWav(f("clip-invalid-44k.wav"))).toEqual({ ok: false, reason: "bad_sample_rate" });
    expect(parseWav(f("clip-invalid-not-riff.wav"))).toEqual({ ok: false, reason: "not_riff_wave" });
  });
});
