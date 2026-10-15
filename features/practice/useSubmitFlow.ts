"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getData } from "@/lib/data";
import { toAppError } from "@/lib/data/errors";
import type { SubmitInit } from "@/lib/data/types";
import { errorUi, type ErrorUi } from "@/features/errors/map";
import { clipToWav16kMono } from "@/features/recording/wav";
import { recordingStore } from "@/features/recording/store";
import { putToSignedUrl } from "@/lib/upload/put";

export type SubmitPhase = "idle" | "preparing" | "uploading" | "analysing";
export type ClipProgress = { slide: number; pct: number; state: "waiting" | "uploading" | "done" | "failed" };
export type SubmitFailure = { code: string; ui: Extract<ErrorUi, { kind: "inline" }>; slideIndex: number | null };

const CONCURRENCY = 3;
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const x = items[i++]!; await fn(x); } }));
}

/**
 * S12 submit: convert each clip to 16 kHz mono WAV → submitInit with exact byte sizes → upload all clips (progress per clip) → analyse → S13.
 * An upload failure keeps the clips that already arrived; Retry re-sends only the failed ones.
 */
export function useSubmitFlow(sessionId: string) {
  const router = useRouter();
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [prep, setPrep] = useState({ done: 0, total: 0 });
  const [progress, setProgress] = useState<ClipProgress[]>([]);
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const wavs = useRef<Map<number, Uint8Array>>(new Map());
  const init = useRef<SubmitInit | null>(null);
  const declared = useRef<{ slide_index: number; size_bytes: number }[]>([]);

  const setClipState = (slide: number, patch: Partial<ClipProgress>) => setProgress((p) => p.map((c) => (c.slide === slide ? { ...c, ...patch } : c)));

  const fail = useCallback((e: unknown) => {
    const err = toAppError(e);
    const ui = errorUi(err.code, err.details);
    if (ui.kind === "route") { router.push(ui.to); return; }
    setFailure({ code: err.code, ui, slideIndex: typeof err.details.slide_index === "number" ? err.details.slide_index : null });
    setPhase("idle");
  }, [router]);

  const uploadClips = useCallback(async (slides: number[]) => {
    setPhase("uploading");
    let failed = 0;
    await pool(slides, CONCURRENCY, async (slide) => {
      const target = init.current?.clips.find((c) => c.slide_index === slide)?.upload;
      const wav = wavs.current.get(slide);
      if (!target || !wav) { failed++; setClipState(slide, { state: "failed" }); return; }
      setClipState(slide, { state: "uploading", pct: 0 });
      try {
        await putToSignedUrl(target, new Blob([wav as BlobPart], { type: "audio/wav" }), { onProgress: (l, t) => setClipState(slide, { pct: t ? Math.round((l / t) * 100) : 0 }) });
        setClipState(slide, { state: "done", pct: 100 });
      } catch { failed++; setClipState(slide, { state: "failed" }); }
    });
    return failed;
  }, []);

  const analyse = useCallback(async () => {
    setPhase("analysing");
    await getData().sessions.analyse(sessionId);
    recordingStore.closeMic();
    router.push(`/session/${sessionId}/analysing`);
  }, [router, sessionId]);

  const submit = useCallback(async () => {
    setFailure(null);
    try {
      const entries = recordingStore.list(sessionId);
      setPhase("preparing"); setPrep({ done: 0, total: entries.length });
      wavs.current = new Map();
      for (const [slide, clip] of entries) {
        wavs.current.set(slide, await clipToWav16kMono(clip.blob));
        setPrep((p) => ({ ...p, done: p.done + 1 }));
      }
      const clips = [...wavs.current.entries()].map(([slide_index, w]) => ({ slide_index, size_bytes: w.length }));
      declared.current = clips;
      init.current = await getData().sessions.submitInit(sessionId, clips);
      setProgress(clips.map((c) => ({ slide: c.slide_index, pct: 0, state: "waiting" })));
      const failed = await uploadClips(clips.map((c) => c.slide_index));
      if (failed) { setFailure({ code: "upload_failed", ui: { kind: "inline", title: "Some recordings didn't upload", body: "Your other recordings are safe. Try again to send the rest.", retry: true }, slideIndex: null }); setPhase("idle"); return; }
      await analyse();
    } catch (e) { fail(e); }
  }, [analyse, fail, sessionId, uploadClips]);

  /** Retry: re-send only the failed clips, then analyse. submit-init is re-callable, so fresh URLs are requested first (the old ones may have expired). */
  const retry = useCallback(async () => {
    setFailure(null);
    try {
      if (!init.current) return submit();
      init.current = await getData().sessions.submitInit(sessionId, declared.current);
      const failedSlides = progress.filter((c) => c.state !== "done").map((c) => c.slide);
      const failed = failedSlides.length ? await uploadClips(failedSlides) : 0;
      if (failed) { setFailure({ code: "upload_failed", ui: { kind: "inline", title: "Some recordings still didn't upload", body: "Check your connection and try again.", retry: true }, slideIndex: null }); setPhase("idle"); return; }
      await analyse();
    } catch (e) { fail(e); }
  }, [analyse, fail, progress, sessionId, submit, uploadClips]);

  return { phase, prep, progress, failure, submit, retry, busy: phase !== "idle" };
}
