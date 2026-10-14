import { describe, expect, it } from "vitest";
import { createMockData, type PersonaId } from "@/lib/data/mock";
import { putToSignedUrl } from "@/lib/upload/put";
import { encodeWav } from "@/features/recording/wav";
import { blobOf, makePdf, makeWav } from "./helpers";
import type { DeckEvent, SessionEvent } from "@/lib/data/types";

const fast = { latencyMs: 0, stageMs: 0 };
const wait = (ms = 5) => new Promise((r) => setTimeout(r, ms));
async function until<T>(fn: () => Promise<T> | T, ok: (v: T) => boolean, ms = 4000): Promise<T> {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (ok(v)) return v; if (Date.now() - t0 > ms) throw new Error("timeout"); await wait(); }
}
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: "image/jpeg" });

async function uploadDeck(m: ReturnType<typeof createMockData>, pages = 3, name = "Deck.pdf") {
  const pdf = await makePdf(pages);
  const init = await m.data.upload.init({ filename: name, size_bytes: pdf.length, content_type: "application/pdf" });
  await putToSignedUrl(init.upload, blobOf(pdf, "application/pdf"));
  const done = await m.data.upload.complete(init.deck_id);
  for (const im of done.images) await putToSignedUrl(im.upload, jpeg());
  await m.data.upload.process(init.deck_id);
  await until(() => m.data.decks.getStatus(init.deck_id), (d) => d.status === "ready");
  return init.deck_id;
}

describe("personas and the shared world", () => {
  it("each persona starts in the documented state", async () => {
    const check = async (p: PersonaId) => createMockData({ persona: p, config: fast });
    const ns = await check("new_student");
    expect((await ns.data.profile.getMine()).profile_completed_at).toBeNull();
    expect(await ns.data.policy.hasAcceptedLatest()).toBe(false);
    const st = await check("student");
    expect((await st.data.decks.list())).toHaveLength(0);
    expect((await st.data.dashboard.getStats()).sessions_used_today).toBe(0);
    const rs = await check("returning_student");
    expect((await rs.data.dashboard.getStats())).toMatchObject({ sessions_used_today: 2, attempts_count: 2, best_score: 74, average_score: 68 });
    const lim = await check("at_limit");
    expect((await lim.data.dashboard.getStats()).sessions_used_today).toBe(5);
    const out = await check("signed_out");
    expect(await out.data.auth.getSession()).toBeNull();
    await expect(out.data.profile.getMine()).rejects.toMatchObject({ code: "not_authenticated" });
    expect((await out.data.policy.getLatest()).version_label).toBe("v3.0"); // Terms/Privacy are public
  });
  it("signing in picks the next persona; owner sign-in picks the admin", async () => {
    const m = createMockData({ persona: "signed_out", config: fast });
    await m.data.auth.signInWithGoogle();
    expect((await m.data.auth.getSession())?.role).toBe("student");
    await m.data.auth.signOut();
    expect(await m.data.auth.getSession()).toBeNull();
    await m.data.auth.signInWithGoogle({ hint: "owner" });
    expect((await m.data.auth.getSession())?.role).toBe("admin");
  });
  it("a policy published by the owner must be re-accepted by the student after switching persona", async () => {
    const m = createMockData({ persona: "admin", config: fast });
    await m.data.admin.publishPolicy({ version_label: "v4.0", terms_body: "## T\nx", privacy_body: "## P\ny", note: "n" });
    m.control.setPersona("returning_student");
    expect(await m.data.policy.hasAcceptedLatest()).toBe(false);
    await expect(m.data.upload.init({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" })).rejects.toMatchObject({ code: "policy_not_accepted" });
    const latest = await m.data.policy.getLatest();
    expect(latest.version_label).toBe("v4.0");
    await m.data.policy.accept(latest.id);
    expect(await m.data.policy.hasAcceptedLatest()).toBe(true);
    await expect(m.data.policy.accept("old")).rejects.toMatchObject({ code: "not_latest_policy" });
  });
  it("republishing while a session is in progress does not stop submission", async () => {
    const m = createMockData({ persona: "returning_student", config: fast });
    const deckId = (await m.data.decks.list())[0]!.deck_id;
    const s = await m.data.sessions.start(deckId, 5);
    m.control.republishPolicy();
    await expect(m.data.reports.rate((await m.data.dashboard.listRecentReports(1))[0]!.report_id, 4)).rejects.toMatchObject({ code: "policy_not_accepted" });
    const wav = makeWav(3);
    const sub = await m.data.sessions.submitInit(s.id, [{ slide_index: 0, size_bytes: wav.length }]);
    await putToSignedUrl(sub.clips[0]!.upload, blobOf(wav, "audio/wav"));
    expect((await m.data.sessions.analyse(s.id)).status).toBe("transcribing");
  });
});

describe("daily limit (IST) and attempt accounting", () => {
  it("counts per IST day: yesterday's sessions do not count, 5 today do", async () => {
    let now = new Date("2026-10-14T20:00:00Z"); // 01:30 IST on the 15th
    const m = createMockData({ persona: "student", config: fast, now: () => now });
    await uploadDeckSafe();
    async function uploadDeckSafe() { await uploadDeck(m, 1); }
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(1);
    now = new Date("2026-10-15T18:29:00Z"); // 23:59 IST same day
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(1);
    now = new Date("2026-10-15T18:31:00Z"); // 00:01 IST next day
    const s = await m.data.dashboard.getStats();
    expect(s.sessions_used_today).toBe(0);
    expect(s.next_reset_at).toBe("2026-10-16T18:30:00.000Z");
  });
  it("attempt 1 is free (paid by the upload), a retake costs one, restarting an unsubmitted attempt does not charge twice", async () => {
    const m = createMockData({ persona: "returning_student", config: fast });
    const deckId = (await m.data.decks.list())[0]!.deck_id;
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(2);
    const a = await m.data.sessions.start(deckId, 5);
    expect(a.attempt_number).toBe(3);
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(3);
    const b = await m.data.sessions.start(deckId, 7); // restart the same attempt
    expect(b.attempt_number).toBe(3);
    expect(b.total_minutes).toBe(7);
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(3);
  });
  it("the 6th session is refused", async () => {
    const m = createMockData({ persona: "at_limit", config: fast });
    const deckId = (await m.data.decks.list())[0]!.deck_id;
    await expect(m.data.sessions.start(deckId, 5)).rejects.toMatchObject({ code: "daily_limit_reached" });
    await expect(m.data.sessions.start(deckId, 99)).rejects.toMatchObject({ code: "invalid_minutes" });
  });
});

describe("decks, pinning, rating", () => {
  it("pinned decks sort first and unpinning restores the order", async () => {
    const m = createMockData({ persona: "returning_student", config: fast });
    const second = await uploadDeck(m, 2, "Second.pdf");
    const first = (await m.data.decks.list()).find((d) => d.title !== "Second")!.deck_id;
    expect((await m.data.decks.list())[0]!.deck_id).toBe(second); // newest activity first
    await m.data.decks.setPinned(first, true);
    expect((await m.data.decks.list())[0]!).toMatchObject({ deck_id: first, pinned: true });
    await m.data.decks.setPinned(first, false);
    expect((await m.data.decks.list())[0]!.deck_id).toBe(second);
  });
  it("a report can be rated once, with 1–5 stars and a comment of at most 500 characters", async () => {
    const m = createMockData({ persona: "returning_student", config: fast });
    const id = (await m.data.dashboard.listRecentReports(1))[0]!.report_id;
    await expect(m.data.reports.rate(id, 0)).rejects.toMatchObject({ code: "invalid_stars" });
    await expect(m.data.reports.rate(id, 6)).rejects.toMatchObject({ code: "invalid_stars" });
    await expect(m.data.reports.rate(id, 4, "x".repeat(501))).rejects.toMatchObject({ code: "comment_too_long" });
    await m.data.reports.rate(id, 4, "  Helpful  ");
    expect((await m.data.reports.get(id)).rating).toEqual({ stars: 4, comment: "Helpful" });
    await expect(m.data.reports.rate(id, 5)).rejects.toMatchObject({ code: "already_rated" });
    await expect(m.data.reports.rate("nope", 5)).rejects.toMatchObject({ code: "not_found" });
  });
  it("asset URLs: seeded decks use the committed JPEGs, uploaded decks use the real rendered images; expiry can be simulated once", async () => {
    const m = createMockData({ persona: "returning_student", config: fast });
    const id = (await m.data.decks.list())[0]!.deck_id;
    const a = await m.data.decks.getAssetUrls(id, ["slide_image"]);
    expect(a.files).toHaveLength(8);
    expect(a.files[0]!.url).toBe("/mock/slides/parksense-1.jpg");
    m.control.breakAssetUrlsOnce();
    expect((await m.data.decks.getAssetUrls(id, ["slide_image"])).files[0]!.url).toContain("expired");
    expect((await m.data.decks.getAssetUrls(id, ["slide_image"])).files[0]!.url).toBe("/mock/slides/parksense-1.jpg");
  });
});

describe("upload validation, resumability and failures", () => {
  it("rejects bad files with the contract's codes and does not consume a session", async () => {
    const m = createMockData({ persona: "student", config: fast });
    const bad = async (bytes: Uint8Array) => {
      const init = await m.data.upload.init({ filename: "x.pdf", size_bytes: bytes.length, content_type: "application/pdf" });
      await putToSignedUrl(init.upload, blobOf(bytes, "application/pdf"));
      return m.data.upload.complete(init.deck_id);
    };
    await expect(bad(new TextEncoder().encode("hello world"))).rejects.toMatchObject({ code: "not_pdf" });
    await expect(bad(new TextEncoder().encode("%PDF-1.7\n" + "garbage ".repeat(50)))).rejects.toMatchObject({ code: "corrupt_pdf" });
    await expect(bad(await makePdf(11))).rejects.toMatchObject({ code: "too_many_pages", details: { page_count: 11, max_pages: 10 } });
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(0);
  });
  it("PUT enforces the signed Content-Type and length like R2", async () => {
    const m = createMockData({ persona: "student", config: fast });
    const pdf = await makePdf(1);
    const init = await m.data.upload.init({ filename: "x.pdf", size_bytes: pdf.length, content_type: "application/pdf" });
    await expect(putToSignedUrl({ url: init.upload.url, headers: { "Content-Type": "text/plain" } }, blobOf(pdf, "application/pdf"))).rejects.toMatchObject({ code: "forbidden" });
    await expect(putToSignedUrl(init.upload, blobOf(new Uint8Array([...pdf, 1]), "application/pdf"))).rejects.toMatchObject({ code: "forbidden" });
    await putToSignedUrl(init.upload, blobOf(pdf, "application/pdf"));
    await expect(m.data.upload.complete("nope")).rejects.toMatchObject({ code: "not_found" });
  });
  it("complete is idempotent while awaiting images; process reports missing images; deck-process failure keeps the session charged once", async () => {
    const m = createMockData({ persona: "student", config: fast });
    const pdf = await makePdf(2);
    const init = await m.data.upload.init({ filename: "x.pdf", size_bytes: pdf.length, content_type: "application/pdf" });
    await putToSignedUrl(init.upload, blobOf(pdf, "application/pdf"));
    const a = await m.data.upload.complete(init.deck_id);
    const b = await m.data.upload.complete(init.deck_id);
    expect(b.images).toHaveLength(2);
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(1);
    await putToSignedUrl(a.images[0]!.upload, jpeg());
    await expect(m.data.upload.process(init.deck_id)).rejects.toMatchObject({ code: "images_missing", details: { missing: [1] } });
    await putToSignedUrl(b.images[1]!.upload, new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }));
    await expect(m.data.upload.process(init.deck_id)).rejects.toMatchObject({ code: "not_jpeg" });
    await putToSignedUrl(b.images[1]!.upload, jpeg());
    m.control.failNext({ kind: "deck-process", code: "ai_unavailable" });
    await m.data.upload.process(init.deck_id);
    const failed = await until(() => m.data.decks.getStatus(init.deck_id), (d) => d.status === "failed");
    expect(failed.error_code).toBe("ai_unavailable");
    await m.data.upload.process(init.deck_id); // retry
    await until(() => m.data.decks.getStatus(init.deck_id), (d) => d.status === "ready");
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(1);
  });
  it("finishing a deck while another is processing is refused", async () => {
    const m = createMockData({ persona: "student", config: { latencyMs: 0, stageMs: 60 } });
    const pdf = await makePdf(2);
    const init = await m.data.upload.init({ filename: "x.pdf", size_bytes: pdf.length, content_type: "application/pdf" });
    await putToSignedUrl(init.upload, blobOf(pdf, "application/pdf"));
    const d = await m.data.upload.complete(init.deck_id);
    for (const im of d.images) await putToSignedUrl(im.upload, jpeg());
    await m.data.upload.process(init.deck_id);
    await expect(m.data.upload.init({ filename: "y.pdf", size_bytes: 10, content_type: "application/pdf" })).rejects.toMatchObject({ code: "deck_in_progress" });
  });
});

describe("realtime stage strings (contract)", () => {
  it("deck: Waiting → Reading slide k of N → null/ready, processed_slides counts up", async () => {
    const m = createMockData({ persona: "student", config: { latencyMs: 0, stageMs: 5 } });
    const events: DeckEvent[] = [];
    const pdf = await makePdf(3);
    const init = await m.data.upload.init({ filename: "x.pdf", size_bytes: pdf.length, content_type: "application/pdf" });
    const unsub = m.data.realtime.subscribeDeck(init.deck_id, (e) => events.push(e));
    await putToSignedUrl(init.upload, blobOf(pdf, "application/pdf"));
    const d = await m.data.upload.complete(init.deck_id);
    for (const im of d.images) await putToSignedUrl(im.upload, jpeg());
    await m.data.upload.process(init.deck_id);
    await until(() => events.at(-1)?.status, (s) => s === "ready");
    unsub();
    expect(events[0]).toMatchObject({ status: "awaiting_images", processing_stage: "Waiting for slide images" });
    expect(events.map((e) => e.processing_stage).filter(Boolean)).toEqual(expect.arrayContaining(["Reading slide 1 of 3", "Reading slide 2 of 3", "Reading slide 3 of 3"]));
    expect(events.map((e) => e.processed_slides)).toEqual([...events.map((e) => e.processed_slides)].sort((a, b) => a - b));
    expect(events.at(-1)).toMatchObject({ status: "ready", processing_stage: null, processed_slides: 3 });
  });
  it("session: Transcribing → Transcribed k of m → Writing your report → completed with report_id; audio deleted", async () => {
    const m = createMockData({ persona: "returning_student", config: { latencyMs: 0, stageMs: 5 } });
    const deckId = (await m.data.decks.list())[0]!.deck_id;
    const s = await m.data.sessions.start(deckId, 5);
    const ev: SessionEvent[] = [];
    m.data.realtime.subscribeSession(s.id, (e) => ev.push(e));
    const wav = makeWav(4);
    const sub = await m.data.sessions.submitInit(s.id, [0, 1].map((i) => ({ slide_index: i, size_bytes: wav.length })));
    for (const c of sub.clips) await putToSignedUrl(c.upload, blobOf(wav, "audio/wav"));
    await m.data.sessions.analyse(s.id);
    await until(() => ev.at(-1)?.status, (x) => x === "completed");
    const stages = ev.map((e) => e.analysis_stage).filter(Boolean).filter((x, i, a) => x !== a[i - 1]);
    expect(stages).toEqual(["Transcribing your recording", "Transcribed 1 of 2", "Transcribed 2 of 2", "Writing your report"]);
    expect(ev.at(-1)!.report_id).toBeTruthy();
    expect(m.backend.blobs.has(`clip/${s.id}/0`)).toBe(false);
  });
});

describe("session submission validation and failures", () => {
  async function started() {
    const m = createMockData({ persona: "returning_student", config: fast });
    const deckId = (await m.data.decks.list())[0]!.deck_id;
    return { m, s: await m.data.sessions.start(deckId, 5) };
  }
  it("submit-init validates the clip list", async () => {
    const { m, s } = await started();
    await expect(m.data.sessions.submitInit(s.id, [])).rejects.toMatchObject({ code: "no_clips" });
    await expect(m.data.sessions.submitInit(s.id, [{ slide_index: 9, size_bytes: 10 }])).rejects.toMatchObject({ code: "invalid_slide_index" });
    await expect(m.data.sessions.submitInit(s.id, [{ slide_index: 0, size_bytes: 10 }, { slide_index: 0, size_bytes: 10 }])).rejects.toMatchObject({ code: "duplicate_slide_index" });
    await expect(m.data.sessions.submitInit(s.id, [{ slide_index: 0, size_bytes: 0 }])).rejects.toMatchObject({ code: "clip_empty" });
    await expect(m.data.sessions.submitInit(s.id, [{ slide_index: 0, size_bytes: 21 * 1024 * 1024 }])).rejects.toMatchObject({ code: "clip_too_large" });
  });
  it("analyse needs every declared clip, and rejects wrong audio with the offending slide and a reason", async () => {
    const { m, s } = await started();
    const good = makeWav(3);
    const sub = await m.data.sessions.submitInit(s.id, [{ slide_index: 0, size_bytes: good.length }, { slide_index: 1, size_bytes: good.length }]);
    await expect(m.data.sessions.analyse(s.id)).rejects.toMatchObject({ code: "clip_missing", details: { slide_index: 0 } });
    await putToSignedUrl(sub.clips[0]!.upload, blobOf(good, "audio/wav"));
    const stereo = new Uint8Array(good); new DataView(stereo.buffer).setUint16(22, 2, true);
    await putToSignedUrl(sub.clips[1]!.upload, blobOf(stereo, "audio/wav"));
    await expect(m.data.sessions.analyse(s.id)).rejects.toMatchObject({ code: "audio_invalid", details: { slide_index: 1, reason: expect.any(String) } });
    await putToSignedUrl(sub.clips[1]!.upload, blobOf(encodeWav(new Float32Array(48000)), "audio/wav")).catch(() => {});
  });
  it("an AI failure marks the session failed and a retry does not charge again; three attempts at most", async () => {
    const { m, s } = await started();
    const wav = makeWav(3);
    const sub = await m.data.sessions.submitInit(s.id, [{ slide_index: 0, size_bytes: wav.length }]);
    await putToSignedUrl(sub.clips[0]!.upload, blobOf(wav, "audio/wav"));
    const used = (await m.data.dashboard.getStats()).sessions_used_today;
    for (let i = 0; i < 3; i++) {
      m.control.failNext({ kind: "session-analyse", code: "ai_unavailable" });
      await m.data.sessions.analyse(s.id);
      const f = await until(() => m.data.sessions.get(s.id), (x) => x.status === "failed");
      expect(f.error_code).toBe("ai_unavailable");
    }
    await expect(m.data.sessions.analyse(s.id)).rejects.toMatchObject({ code: "max_attempts" });
    expect((await m.data.dashboard.getStats()).sessions_used_today).toBe(used);
  });
  it("blocked students cannot write, but can read", async () => {
    const m = createMockData({ persona: "blocked", config: fast });
    expect(await m.data.decks.list()).toHaveLength(1);
    const deckId = (await m.data.decks.list())[0]!.deck_id;
    await expect(m.data.decks.setPinned(deckId, true)).rejects.toMatchObject({ code: "blocked" });
    await expect(m.data.sessions.start(deckId, 5)).rejects.toMatchObject({ code: "blocked" });
    await expect(m.data.profile.update({ college: "x", year: "3rd year", branch: "CSE" })).rejects.toMatchObject({ code: "blocked" });
    expect((await m.data.reports.get((await m.data.dashboard.listRecentReports(1))[0]!.report_id)).report.overall_score).toBe(74);
  });
});

describe("account deletion and admin", () => {
  it("deleting the account clears everything and signs out", async () => {
    const m = createMockData({ persona: "returning_student", config: fast });
    await expect(m.data.account.delete("DELETE" as const)).resolves.toEqual({ deleted: true, storage_cleanup: "complete" });
    expect(await m.data.auth.getSession()).toBeNull();
    expect(m.control.snapshot().decks).toHaveLength(0);
  });
  it("admins cannot practise or delete an account; students cannot call admin RPCs", async () => {
    const a = createMockData({ persona: "admin", config: fast });
    await expect(a.data.account.delete("DELETE")).rejects.toMatchObject({ code: "is_admin" });
    await expect(a.data.profile.getMine()).resolves.toMatchObject({ role: "admin" });
    expect(await a.data.policy.hasAcceptedLatest()).toBe(true);
    const s = createMockData({ persona: "student", config: fast });
    for (const call of [() => s.data.admin.overview(), () => s.data.admin.listStudents({}), () => s.data.admin.aiUsage(7), () => s.data.admin.ratings()]) await expect(call()).rejects.toMatchObject({ code: "forbidden" });
  });
  it("admin data: search, block/unblock, student detail, ratings filter, AI usage 3×3, publish rules", async () => {
    const m = createMockData({ persona: "admin", config: fast });
    const all = await m.data.admin.listStudents({});
    expect(all).toHaveLength(10);
    expect(all.filter((s) => s.is_blocked).map((s) => s.full_name)).toEqual(["Divya Menon"]);
    expect((await m.data.admin.listStudents({ search: "COEP" })).map((s) => s.full_name)).toEqual(["Meera Joshi"]);
    const arjun = all.find((s) => s.full_name === "Arjun Reddy")!;
    await m.data.admin.setBlocked(arjun.user_id, true);
    expect((await m.data.admin.listStudents({ search: "arjun" }))[0]!.is_blocked).toBe(true);
    await m.data.admin.setBlocked(arjun.user_id, false);
    await expect(m.data.admin.setBlocked("nope", true)).rejects.toMatchObject({ code: "not_found" });
    expect((await m.data.admin.studentDetail(all.find((s) => s.full_name === "Ananya Rao")!.user_id)).attempts.map((a) => a.overall_score)).toEqual([74, 62]);
    expect((await m.data.admin.studentDetail(all.find((s) => s.full_name === "Vikram Singh")!.user_id)).attempts).toEqual([]);
    const r = await m.data.admin.ratings(5);
    expect(r.rows.every((x) => x.stars === 5)).toBe(true);
    expect((await m.data.admin.ratings(1)).rows).toEqual([]);
    expect((await m.data.admin.ratings()).count).toBe(8);
    const usage = await m.data.admin.aiUsage(7);
    expect(usage.purposes.map((p) => p.purpose)).toEqual(["slide_reading", "speech_to_text", "report_generation"]);
    expect(usage.purposes.every((p) => p.slots.length === 3 && p.per_day.length === 7)).toBe(true);
    expect(usage.purposes[1]!.slots[0]!.running_low).toBe(true);
    const keys = await m.data.admin.aiKeys();
    expect(keys.purposes[0]!.slots.map((s) => s.configured)).toEqual([true, true, false]);
    expect(JSON.stringify(keys)).not.toMatch(/nvapi|sk-/);
    const per = await m.data.admin.sessionsPerDay(14);
    expect(per).toHaveLength(14);
    expect(per.at(-1)!.count).toBe(66);
    await expect(m.data.admin.publishPolicy({ version_label: "v3.0", terms_body: "a", privacy_body: "b" })).rejects.toMatchObject({ code: "label_not_increasing" });
    await expect(m.data.admin.publishPolicy({ version_label: "four", terms_body: "a", privacy_body: "b" })).rejects.toMatchObject({ code: "invalid_label" });
    await expect(m.data.admin.publishPolicy({ version_label: "v4.0", terms_body: "", privacy_body: "b" })).rejects.toMatchObject({ code: "invalid_body" });
    await m.data.admin.publishPolicy({ version_label: "v4.0", terms_body: "a", privacy_body: "b" });
    expect((await m.data.admin.policyVersions())[0]).toMatchObject({ version_label: "v4.0", is_live: true });
  });
  it("persists to storage and resumes after a 'refresh'", async () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } as Storage;
    const a = createMockData({ storage, persona: "returning_student", config: fast });
    const deckId = (await a.data.decks.list())[0]!.deck_id;
    await a.data.decks.setPinned(deckId, true);
    const b = createMockData({ storage, config: fast });
    expect((await b.data.decks.list())[0]!.pinned).toBe(true);
    store.set("m2p.mock.seed", "admin");
    const c = createMockData({ storage, config: fast });
    expect((await c.data.auth.getSession())?.role).toBe("admin");
    expect(store.has("m2p.mock.seed")).toBe(false);
  });
});
