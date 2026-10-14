import { describe, expect, it } from "vitest";
import { createMockData } from "@/lib/data/mock";
import { putToSignedUrl } from "@/lib/upload/put";
import { AppError } from "@/lib/data/errors";
import { blobOf, makePdf, makeWav } from "./helpers";

const fast = { latencyMs: 0, stageMs: 0 };
async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 4000): Promise<T> {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (ok(v)) return v; if (Date.now() - t0 > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 5)); }
}

describe("mock backend: full upload → practise → report flow", () => {
  it("runs the whole pipeline with real PDF + WAV validation", async () => {
    const { data } = createMockData({ persona: "student", config: fast });
    const pdf = await makePdf(3);
    const init = await data.upload.init({ filename: "My Pitch.pdf", size_bytes: pdf.length, content_type: "application/pdf" });
    await putToSignedUrl(init.upload, blobOf(pdf, "application/pdf"));
    const done = await data.upload.complete(init.deck_id);
    expect(done.page_count).toBe(3);
    expect(done.rules.max_bytes).toBe(1_000_000);
    expect((await data.dashboard.getStats()).sessions_used_today).toBe(1);
    for (const im of done.images) await putToSignedUrl(im.upload, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: "image/jpeg" }));
    expect((await data.upload.process(init.deck_id)).status).toBe("processing");
    await waitFor(() => data.decks.getStatus(init.deck_id), (d) => d.status === "ready");
    const detail = await data.decks.get(init.deck_id);
    expect(detail.slides).toHaveLength(3);
    expect(detail.slides[0]!.title).toBe("Slide 1 title");
    const session = await data.sessions.start(init.deck_id, 5);
    expect(session.suggested_seconds.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(299);
    const wav = makeWav(20);
    const sub = await data.sessions.submitInit(session.id, [{ slide_index: 0, size_bytes: wav.length }, { slide_index: 1, size_bytes: wav.length }]);
    for (const c of sub.clips) await putToSignedUrl(c.upload, blobOf(wav, "audio/wav"));
    expect((await data.sessions.analyse(session.id)).status).toBe("transcribing");
    const s = await waitFor(() => data.sessions.get(session.id), (x) => x.status === "completed");
    const rep = await data.reports.get(s.report_id!);
    const r = rep.report;
    expect(Math.round(0.35 * r.coverage_score + 0.25 * r.clarity_score + 0.2 * r.timing_score + 0.2 * r.filler_score)).toBe(r.overall_score);
    expect(rep.results).toHaveLength(3);
    expect(rep.results[2]!.duration_ms).toBe(0); // slide 3 was not recorded
    expect(rep.results[0]!.duration_ms).toBe(20000);
  });

  it("enforces the Phase 1 error codes", async () => {
    const m = createMockData({ persona: "at_limit", config: fast });
    await expect(m.data.upload.init({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" })).rejects.toMatchObject({ code: "daily_limit_reached" });
    const b = createMockData({ persona: "blocked", config: fast });
    await expect(b.data.upload.init({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" })).rejects.toMatchObject({ code: "blocked" });
    expect((await b.data.decks.list())).toHaveLength(1); // reads still work
    const n = createMockData({ persona: "new_student", config: fast });
    await expect(n.data.upload.init({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" })).rejects.toMatchObject({ code: "profile_incomplete" });
    const a = createMockData({ persona: "admin", config: fast });
    await expect(a.data.upload.init({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" })).rejects.toMatchObject({ code: "is_admin" });
    const s = createMockData({ persona: "student", config: fast });
    await expect(s.data.admin.overview()).rejects.toBeInstanceOf(AppError);
    await expect(s.data.upload.init({ filename: "a.txt", size_bytes: 10, content_type: "text/plain" })).rejects.toMatchObject({ code: "not_pdf" });
    await expect(s.data.upload.init({ filename: "a.pdf", size_bytes: 5 * 1024 * 1024 + 1, content_type: "application/pdf" })).rejects.toMatchObject({ code: "too_large" });
  });
});
