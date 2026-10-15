// Generates PDF fixtures for the E2E tests under tests/fixtures/. Run: npx tsx scripts/gen-e2e-fixtures.mjs
import fs from "node:fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function pdf(pages, titles) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([960, 540]);
    p.drawText(titles?.[i] ?? `Slide ${i + 1}`, { x: 60, y: 450, size: 38, font });
    ["First key idea for this slide", "Second key idea for this slide", "Third key idea for this slide"].forEach((t, k) => p.drawText(t, { x: 60, y: 380 - k * 44, size: 22, font }));
  }
  return doc.save();
}
fs.mkdirSync("tests/fixtures", { recursive: true });
fs.writeFileSync("tests/fixtures/deck-3.pdf", await pdf(3, ["Problem", "Solution", "Thank you"]));
fs.writeFileSync("tests/fixtures/deck-11.pdf", await pdf(11));
fs.writeFileSync("tests/fixtures/corrupt.pdf", Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.from("this is not a real pdf body ".repeat(40))]));
fs.writeFileSync("tests/fixtures/not-a-pdf.txt", "just some text\n");
console.log("fixtures written");
