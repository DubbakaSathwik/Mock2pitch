// Browser PDF handling with pdf.js (loaded lazily, client only): validation, page count, text, and page → JPEG rendering.
import { MAX_PDF_BYTES, MAX_SLIDES } from "@shared/constants.ts";
import type { SlideImageRules } from "@/lib/data/types";
import { encodeUntilFits, type EncodeResult } from "./jpeg-rules";

type PdfJs = typeof import("pdfjs-dist");
let cached: Promise<PdfJs> | null = null;

/** pdf.js with its worker. In Node (unit tests) the legacy build runs with the in-process "fake worker". */
export function loadPdfjs(): Promise<PdfJs> {
  cached ??= (async () => {
    if (typeof window === "undefined") {
      const lib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJs;
      return lib;
    }
    const lib = await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return lib;
  })();
  return cached;
}

export type PdfFailure = "encrypted" | "corrupt";
export type OpenResult = { ok: true; doc: import("pdfjs-dist").PDFDocumentProxy; pageCount: number } | { ok: false; reason: PdfFailure };

/** Opens a PDF (never throws). Password-protected → `encrypted`; anything unreadable → `corrupt`. */
export async function openPdf(data: Uint8Array | ArrayBuffer): Promise<OpenResult> {
  const lib = await loadPdfjs();
  try {
    const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data.slice(0));
    const task = lib.getDocument({ data: bytes, useSystemFonts: false, verbosity: 0 });
    const doc = await task.promise;
    return { ok: true, doc, pageCount: doc.numPages };
  } catch (e) {
    const name = (e as { name?: string } | null)?.name;
    return { ok: false, reason: name === "PasswordException" ? "encrypted" : "corrupt" };
  }
}

/** Frees the worker and memory held by a document. */
export async function closePdf(doc: import("pdfjs-dist").PDFDocumentProxy): Promise<void> {
  try { await doc.loadingTask.destroy(); } catch { /* already closed */ }
}

/** Plain text of each page (first line = title). Used only by the mock backend to fake "AI reading". */
export async function extractPageTexts(doc: import("pdfjs-dist").PDFDocumentProxy, maxPages = MAX_SLIDES): Promise<string[]> {
  const out: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines: string[] = [];
    let line = ""; let lastY: number | null = null;
    for (const item of content.items as { str?: string; transform?: number[]; hasEOL?: boolean }[]) {
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2 && line.trim()) { lines.push(line.trim()); line = ""; }
      line += item.str; lastY = y;
      if (item.hasEOL && line.trim()) { lines.push(line.trim()); line = ""; }
    }
    if (line.trim()) lines.push(line.trim());
    out.push(lines.join("\n"));
    page.cleanup();
  }
  return out;
}

export type ClientCheck =
  | { ok: true; doc: import("pdfjs-dist").PDFDocumentProxy; pageCount: number }
  | { ok: false; code: "not_pdf" | "too_large" | "too_many_pages" | "encrypted_pdf" | "corrupt_pdf"; pageCount?: number };

/** Client-side pre-checks before anything is uploaded (the server re-checks everything). */
export async function checkPdfFile(file: Blob & { name?: string }): Promise<ClientCheck> {
  const name = file.name ?? "";
  const looksPdf = /\.pdf$/i.test(name) || file.type === "application/pdf";
  if (!looksPdf) return { ok: false, code: "not_pdf" };
  if (file.size > MAX_PDF_BYTES) return { ok: false, code: "too_large" };
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...head) !== "%PDF-") return { ok: false, code: "not_pdf" };
  const opened = await openPdf(await file.arrayBuffer());
  if (!opened.ok) return { ok: false, code: opened.reason === "encrypted" ? "encrypted_pdf" : "corrupt_pdf" };
  if (opened.pageCount > MAX_SLIDES) { void closePdf(opened.doc); return { ok: false, code: "too_many_pages", pageCount: opened.pageCount }; }
  return { ok: true, doc: opened.doc, pageCount: opened.pageCount };
}

const hasOffscreen = () => typeof OffscreenCanvas !== "undefined";

/** Renders one page (1-based) to a JPEG that satisfies `rules`. Canvases are released between attempts and pages. */
export async function renderPageToJpeg(doc: import("pdfjs-dist").PDFDocumentProxy, pageNumber: number, rules: SlideImageRules): Promise<EncodeResult<Blob>> {
  const page = await doc.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    return await encodeUntilFits<Blob>(rules, async ({ width, quality }) => {
      const viewport = page.getViewport({ scale: width / base.width });
      const w = Math.round(viewport.width), h = Math.round(viewport.height);
      const canvas: HTMLCanvasElement | OffscreenCanvas = hasOffscreen() ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) throw new Error("canvas_unavailable");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      await page.render({ canvasContext: ctx, canvas: canvas as HTMLCanvasElement, viewport }).promise;
      const blob: Blob = canvas instanceof OffscreenCanvas
        ? await canvas.convertToBlob({ type: "image/jpeg", quality })
        : await new Promise<Blob>((res, rej) => (canvas as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("encode_failed"))), "image/jpeg", quality));
      canvas.width = 0; canvas.height = 0; // release memory between attempts
      return { blob, size: blob.size };
    });
  } finally { page.cleanup(); }
}
