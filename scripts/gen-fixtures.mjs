// Generates the small committed test fixtures in tests/fixtures. Requires ffmpeg (for JPEG + synthetic speech).
// Usage: node scripts/gen-fixtures.mjs
import { PDFDocument } from "pdf-lib";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");
fs.mkdirSync(out, { recursive: true });
const w = (name, data) => fs.writeFileSync(path.join(out, name), data);
const ff = (...args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);

async function pdf(pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) { const p = doc.addPage([640, 360]); p.drawText(`Slide ${i + 1}`, { x: 40, y: 300, size: 28 }); }
  return doc.save();
}
w("deck-3-pages.pdf", await pdf(3));
w("deck-10-pages.pdf", await pdf(10));
w("deck-11-pages.pdf", await pdf(11));
// Hand-written PDF whose trailer carries /Encrypt (pdf-lib refuses to load these).
w("deck-encrypted.pdf", `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >> endobj
4 0 obj << /Filter /Standard /V 1 /R 2 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) /P -4 >> endobj
trailer << /Root 1 0 R /Size 5 /Encrypt 4 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>] >>
%%EOF
`);
w("not-a-pdf.pdf", Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from("this is a zip-like file renamed to .pdf".padEnd(300, "x"))]));
w("corrupt.pdf", "%PDF-1.4\nthis is not really a pdf, no objects here\n%%EOF");

// Slide JPEGs (small, valid).
for (const [i, color] of ["0x1e293b", "0x0f766e", "0x7c2d12"].entries()) {
  ff("-f", "lavfi", "-i", `color=c=${color}:s=640x360`, "-frames:v", "1", "-q:v", "6", path.join(out, `slide-${i + 1}.jpg`));
}
w("not-a-jpeg.jpg", Buffer.from("\x89PNG\r\n\x1a\n".padEnd(200, "z"), "binary"));

// Audio. Canonical target: 16 kHz mono 16-bit PCM WAV.
const wavArgs = ["-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le"];
ff("-f", "lavfi", "-i", "sine=frequency=220:duration=3", ...wavArgs, path.join(out, "clip-valid-3s.wav"));
ff("-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "3", ...wavArgs, path.join(out, "clip-silent-3s.wav"));
ff("-f", "lavfi", "-i", "sine=frequency=220:duration=2", "-ar", "16000", "-ac", "2", "-c:a", "pcm_s16le", path.join(out, "clip-invalid-stereo.wav"));
ff("-f", "lavfi", "-i", "sine=frequency=220:duration=2", "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", path.join(out, "clip-invalid-44k.wav"));
w("clip-invalid-not-riff.wav", Buffer.alloc(4096, 0x41));
// SYNTHETIC speech (flite text-to-speech) containing filler words. Good for plumbing; NOT a measure of how the real ASR
// treats a human's "um"/"uh". A human recording is still needed for the live filler-retention spike (docs/phase-1/spikes.md).
const text = "So um we built the system and uh it is like really fast. Basically you know it actually works and we are happy with it.";
ff("-f", "lavfi", "-i", `flite=text='${text}':voice=slt`, ...wavArgs, path.join(out, "clip-fillers-synthetic.wav"));
console.log(fs.readdirSync(out).map((f) => `${f} ${fs.statSync(path.join(out, f)).size}`).join("\n"));
