"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { AppError, toAppError } from "@/lib/data/errors";
import type { UploadComplete } from "@/lib/data/types";
import { errorUi, type ErrorUi } from "@/features/errors/map";
import { putToSignedUrl } from "@/lib/upload/put";
import { qk } from "@/lib/query";
import { checkPdfFile, closePdf, renderPageToJpeg } from "./pdf";

export type UploadPhase =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "uploading"; pct: number }
  | { kind: "rendering"; page: number; total: number }
  | { kind: "sending-images"; done: number; total: number }
  | { kind: "starting" };

export type UploadFailure = { code: string; ui: Extract<ErrorUi, { kind: "inline" }> };

const CONCURRENCY = 3;

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const x = items[i++]!; await fn(x); } }));
}

/**
 * Orchestrates S6: client checks → init → PUT pdf → complete (consumes the daily session) → render pages with pdf.js →
 * PUT images → process → S7. Route-type errors (limit, blocked, policy…) navigate; everything else becomes an inline failure
 * rendered under the dropzone with a retry that reuses the chosen file.
 */
export function useUploadFlow() {
  const router = useRouter();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<UploadPhase>({ kind: "idle" });
  const [failure, setFailure] = useState<UploadFailure | null>(null);
  const lastFile = useRef<File | null>(null);
  /** Set once `complete` succeeded (the daily session is consumed): a retry then resumes this deck instead of creating (and paying for) another. */
  const resumeDeck = useRef<string | null>(null);
  const busy = useRef(false);

  const fail = useCallback((e: unknown, details: Record<string, unknown> = {}) => {
    if (!(e instanceof AppError)) console.error("[upload] unexpected error", e);
    const err = toAppError(e);
    const ui = errorUi(err.code, { ...err.details, ...details });
    if (["too_many_pages", "not_pdf", "encrypted_pdf", "corrupt_pdf", "size_mismatch", "upload_missing", "invalid_state", "not_found"].includes(err.code)) resumeDeck.current = null; // the deck is dead: start afresh
    if (ui.kind === "route") { router.push(ui.to); setPhase({ kind: "idle" }); return; }
    setFailure({ code: err.code, ui });
    setPhase({ kind: "idle" });
  }, [router]);

  const start = useCallback(async (file: File) => {
    if (busy.current) return;
    busy.current = true; lastFile.current = file; setFailure(null);
    let doc: import("pdfjs-dist").PDFDocumentProxy | undefined;
    try {
      setPhase({ kind: "validating" });
      const check = await checkPdfFile(file);
      if (!check.ok) { fail(new AppError(check.code), { page_count: check.pageCount, max_pages: 10 }); return; }
      doc = check.doc;
      const data = getData();

      let deckId = resumeDeck.current;
      if (!deckId) {
        const init = await data.upload.init({ filename: file.name, size_bytes: file.size, content_type: "application/pdf" });
        setPhase({ kind: "uploading", pct: 0 });
        await putToSignedUrl(init.upload, file, { onProgress: (l, t) => setPhase({ kind: "uploading", pct: t ? Math.round((l / t) * 100) : 0 }) });
        deckId = init.deck_id;
      }
      // `complete` is idempotent while the deck awaits its images (it re-issues the image URLs and never consumes a second session).
      const done: UploadComplete = await data.upload.complete(deckId);
      resumeDeck.current = deckId;
      void qc.invalidateQueries({ queryKey: qk.stats });

      const blobs: Blob[] = [];
      for (let p = 1; p <= done.page_count; p++) {
        setPhase({ kind: "rendering", page: p, total: done.page_count });
        const r = await renderPageToJpeg(check.doc, p, done.rules);
        blobs.push(r.blob);
      }
      let images = done.images;
      const send = async (indexes: number[]) => {
        let n = 0;
        setPhase({ kind: "sending-images", done: 0, total: indexes.length });
        await pool(indexes, CONCURRENCY, async (i) => {
          const target = () => images.find((x) => x.slide_index === i)!.upload;
          try { await putToSignedUrl(target(), blobs[i]!); }
          catch (e) {
            if (!(e instanceof AppError) || e.code !== "upload_failed") throw e;
            images = (await data.upload.complete(deckId!)).images; // expired URL or a network blip: fresh URLs, then one more try
            await putToSignedUrl(target(), blobs[i]!);
          }
          setPhase({ kind: "sending-images", done: ++n, total: indexes.length });
        });
      };
      await send(blobs.map((_, i) => i));
      setPhase({ kind: "starting" });
      try { await data.upload.process(deckId); }
      catch (e) {
        const err = toAppError(e);
        if (err.code !== "images_missing") throw err;
        await send((err.details.missing as number[]) ?? []); // re-upload only the slides the server did not get
        await data.upload.process(deckId);
      }
      resumeDeck.current = null;
      router.push(`/practice/${deckId}/reading`);
    } catch (e) { fail(e); }
    finally { busy.current = false; if (doc) void closePdf(doc); }
  }, [fail, qc, router]);

  const retry = useCallback(() => { if (lastFile.current) void start(lastFile.current); }, [start]);
  const dismiss = useCallback(() => setFailure(null), []);
  return { phase, failure, start, retry, dismiss, busy: phase.kind !== "idle" };
}
