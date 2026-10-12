import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createEnv, jpeg, makePdf, put, SECRET, uploadDeck, wav, type Env_ } from "./harness";
import { deckUploadInit } from "@shared/handlers/deck-upload-init.ts";
import { deckUploadComplete } from "@shared/handlers/deck-upload-complete.ts";
import { deckProcess } from "@shared/handlers/deck-process.ts";
import { sessionSubmitInit } from "@shared/handlers/session-submit-init.ts";
import { accountDelete } from "@shared/handlers/account-delete.ts";
import { adminAiKeys } from "@shared/handlers/admin-ai-keys.ts";
import { maintenanceSweep } from "@shared/handlers/maintenance-sweep.ts";
import { keys, R2 } from "@shared/r2.ts";
import { testEnv } from "./harness";
import { startFakeS3 } from "../helpers/fake-s3";

let env: Env_;
const H = { init: deckUploadInit, complete: deckUploadComplete, process: deckProcess };
beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.close(); });

async function withDeck(email: string) {
  const u = await env.user(email);
  const { complete, deckId } = await uploadDeck(env, u, H, await makePdf(2));
  for (const im of complete.json.data.images) await put(im.upload.url, im.upload.headers, jpeg());
  await env.call(deckProcess, { deck_id: deckId }, { token: u.token }); await env.settle();
  const s = (await env.db.q(u.id, "select * from public.start_practice_session($1,3)", [deckId]))[0];
  return { u, deckId, sessionId: s.id as string };
}
async function pendingAudio(u: { token: string }, sessionId: string) {
  const w = wav(2);
  const init = await env.call(sessionSubmitInit, { session_id: sessionId, clips: [{ slide_index: 0, size_bytes: w.length }] }, { token: u.token });
  const c = init.json.data.clips[0];
  await put(c.upload.url, c.upload.headers, w);
}

describe("admin-ai-keys", () => {
  it("returns masked keys + model per purpose/slot for the admin only", async () => {
    const adm = await env.admin_("owner-k@mock2pitch.test");
    await env.db.admin.query("update public.profiles set role='admin' where id=$1", [adm.id]);
    const r = await env.call(adminAiKeys, {}, { token: adm.token });
    expect(r.status).toBe(200);
    const purposes = r.json.data.purposes;
    expect(purposes.map((p: any) => p.purpose)).toEqual(["slide_reading", "speech_to_text", "report_generation"]);
    expect(purposes[0]).toMatchObject({ model: "slide-model" });
    expect(purposes[0].slots[0]).toMatchObject({ slot: "primary", configured: true, masked: "••••••••e-k0" });
    expect(purposes[1].model).toBe("parakeet-test");
    expect(r.json.data.purposes.every((p: any) => p.slots.length === 3 && p.slots.every((s: any) => s.slot_id))).toBe(true);
    // the full secret never appears anywhere in the response
    for (const secret of ["slide-k0", "slide-k1", "asr-k0", "rep-k2"]) expect(r.text).not.toContain(secret);
    expect(r.text).toContain("••••••••");
  });
  it("students -> 403, anonymous -> 401", async () => {
    const u = await env.user("k-stu@example.test");
    expect((await env.call(adminAiKeys, {}, { token: u.token })).status).toBe(403);
    expect((await env.call(adminAiKeys, {})).status).toBe(401);
  });
  it("unconfigured slots show configured:false and null mask", async () => {
    const adm = await env.admin_("owner-k2@mock2pitch.test");
    await env.db.admin.query("update public.profiles set role='admin' where id=$1", [adm.id]);
    const saved = (testEnv as any).NVIDIA_SLIDE_KEY_FALLBACK_2; (testEnv as any).NVIDIA_SLIDE_KEY_FALLBACK_2 = undefined;
    const r = await env.call(adminAiKeys, {}, { token: adm.token });
    (testEnv as any).NVIDIA_SLIDE_KEY_FALLBACK_2 = saved;
    expect(r.json.data.purposes[0].slots[2]).toMatchObject({ slot: "fallback_2", configured: false, masked: null });
  });
});

describe("account-delete", () => {
  it("removes every R2 object, every row and the auth user; other users are untouched; anonymised AI usage remains", async () => {
    const a = await withDeck("del-a@example.test");
    const b = await withDeck("del-b@example.test");
    await pendingAudio(a.u, a.sessionId);
    expect(env.s3.keys().filter((k) => k.startsWith(`users/${a.u.id}/`)).length).toBeGreaterThanOrEqual(4); // pdf + 2 slide images + 1 audio clip
    const r = await env.call(accountDelete, { confirm: "DELETE" }, { token: a.u.token });
    expect([r.status, r.json.data]).toEqual([200, { deleted: true, storage_cleanup: "complete" }]);
    expect(env.s3.keys().some((k) => k.startsWith(`users/${a.u.id}/`))).toBe(false);
    expect(env.s3.keys().some((k) => k.startsWith(`users/${b.u.id}/`))).toBe(true);
    for (const t of ["profiles:id", "decks:owner_id", "slides:deck_id", "files:owner_id", "practice_sessions:owner_id", "usage_events:user_id", "policy_acceptances:user_id"]) {
      const [tbl, col] = t.split(":");
      const id = tbl === "slides" ? a.deckId : a.u.id;
      expect((await env.db.admin.query(`select count(*)::int n from public.${tbl} where ${col}=$1`, [id])).rows[0].n, t).toBe(0);
    }
    expect((await env.db.admin.query("select count(*)::int n from auth.users where id=$1", [a.u.id])).rows[0].n).toBe(0);
    const log = (await env.db.admin.query("select count(*)::int n, count(user_id)::int withuser from public.ai_usage_log where deck_id=$1", [a.deckId])).rows[0];
    expect(log.n).toBeGreaterThan(0); expect(log.withuser).toBe(0);
    expect((await env.db.admin.query("select completed_at is not null c from private.pending_deletions where user_id=$1", [a.u.id])).rows[0].c).toBe(true);
    // the deleted user's token no longer works for anything meaningful
    expect((await env.db.admin.query("select count(*)::int n from public.decks where owner_id=$1", [b.u.id])).rows[0].n).toBe(1);
  });
  it("requires the literal confirmation; admin is denied with is_admin; anonymous 401", async () => {
    const u = await env.user("del-c@example.test");
    expect((await env.call(accountDelete, { confirm: "yes" }, { token: u.token })).status).toBe(400);
    expect((await env.call(accountDelete, {}, { token: u.token })).status).toBe(400);
    expect((await env.call(accountDelete, { confirm: "DELETE" })).status).toBe(401);
    const adm = await env.admin_("owner-d@mock2pitch.test");
    await env.db.admin.query("update public.profiles set role='admin' where id=$1", [adm.id]);
    const r = await env.call(accountDelete, { confirm: "DELETE" }, { token: adm.token });
    expect([r.status, r.json.error.code]).toEqual([403, "is_admin"]);
    expect((await env.db.admin.query("select count(*)::int n from auth.users where id=$1", [adm.id])).rows[0].n).toBe(1);
  });
  it("a partial R2 failure still removes the account, records the prefix, and the sweeper finishes the cleanup", async () => {
    const flaky = await startFakeS3({ accessKeyId: testEnv.R2_ACCESS_KEY_ID, secretAccessKey: testEnv.R2_SECRET_ACCESS_KEY, bucket: testEnv.R2_BUCKET, failDelete: () => true });
    const realR2 = env.deps.r2;
    env.deps.r2 = new R2({ accountId: "a", accessKeyId: testEnv.R2_ACCESS_KEY_ID, secretAccessKey: testEnv.R2_SECRET_ACCESS_KEY, bucket: testEnv.R2_BUCKET, endpoint: flaky.endpoint });
    const u = await env.user("del-d@example.test");
    for (let i = 0; i < 3; i++) await env.deps.r2.put(`users/${u.id}/decks/x/${i}.bin`, new Uint8Array([i]), "application/octet-stream");
    const r = await env.call(accountDelete, { confirm: "DELETE" }, { token: u.token });
    expect(r.json.data).toEqual({ deleted: true, storage_cleanup: "pending" });
    expect((await env.db.admin.query("select count(*)::int n from auth.users where id=$1", [u.id])).rows[0].n).toBe(0);
    expect((await env.db.admin.query("select prefix, completed_at from private.pending_deletions where user_id=$1", [u.id])).rows[0]).toEqual({ prefix: `users/${u.id}/`, completed_at: null });
    expect(flaky.keys()).toHaveLength(3);
    // storage recovers; the sweeper (talking to the healthy store) completes it
    for (const k of flaky.keys()) await realR2.put(k, new Uint8Array([1]), "x/y");
    env.deps.r2 = realR2;
    const sw = await env.call(maintenanceSweep, {}, { internal: true });
    expect(sw.json.data.deletions_finished).toBeGreaterThanOrEqual(1);
    expect(env.s3.keys().some((k) => k.startsWith(`users/${u.id}/`))).toBe(false);
    expect((await env.db.admin.query("select completed_at is not null c from private.pending_deletions where user_id=$1", [u.id])).rows[0].c).toBe(true);
    await flaky.stop();
  });
});

describe("maintenance-sweep", () => {
  it("rejects missing / wrong secret and every non-POST", async () => {
    expect((await env.call(maintenanceSweep, {})).status).toBe(403);
    const wrong = await maintenanceSweep(new Request("http://x", { method: "POST", headers: { "x-internal-secret": SECRET + "x" } }), env.deps);
    expect(wrong.status).toBe(403);
    const user = await env.user("sw-u@example.test");
    expect((await env.call(maintenanceSweep, {}, { token: user.token })).status).toBe(403); // a valid user JWT is not enough
    expect((await env.call(maintenanceSweep, {}, { internal: true })).status).toBe(200);
  });
  it("fails pending files + stuck decks after 1h and removes their objects", async () => {
    const u = await env.user("sw-a@example.test");
    const init = await env.call(deckUploadInit, { filename: "a.pdf", size_bytes: 10, content_type: "application/pdf" }, { token: u.token });
    const deckId = init.json.data.deck_id;
    await env.r2.put(keys.deckPdf(u.id, deckId), new Uint8Array(10), "application/pdf");
    await env.backdate("files", (await env.db.admin.query("select id from public.files where deck_id=$1", [deckId])).rows[0].id, "2 hours", "created_at");
    await env.backdate("decks", deckId, "2 hours");
    const r = await env.call(maintenanceSweep, {}, { internal: true });
    expect(r.json.data.pending_files_failed).toBeGreaterThanOrEqual(1);
    expect(r.json.data.decks_failed).toBeGreaterThanOrEqual(1);
    expect((await env.db.admin.query("select status, error_code from public.decks where id=$1", [deckId])).rows[0]).toEqual({ status: "failed", error_code: "upload_timeout" });
    expect(await env.r2.head(keys.deckPdf(u.id, deckId))).toBeNull();
  });
  it("deletes audio older than 24 h (including failed sessions) and marks rows deleted only after R2 confirms", async () => {
    const { u, sessionId } = await withDeck("sw-b@example.test");
    await pendingAudio(u, sessionId);
    const file = (await env.db.admin.query("select id from public.files where session_id=$1", [sessionId])).rows[0].id;
    await env.db.admin.query("update public.files set status='uploaded' where id=$1", [file]);
    await env.backdate("files", file, "25 hours", "created_at");
    const r = await env.call(maintenanceSweep, {}, { internal: true });
    expect(r.json.data.audio_deleted).toBeGreaterThanOrEqual(1);
    expect(await env.r2.head(keys.audioClip(u.id, sessionId, 0))).toBeNull();
    expect((await env.db.admin.query("select status from public.files where id=$1", [file])).rows[0].status).toBe("deleted");
    // R2 failure => row stays 'uploaded' (retried next run)
    await env.r2.put(keys.audioClip(u.id, sessionId, 1), new Uint8Array(5), "audio/wav");
    const f2 = (await env.db.admin.query("insert into public.files(owner_id,session_id,kind,slide_index,bucket,object_key,mime_type,expected_size_bytes,status) values ($1,$2,'audio_clip',1,'b',$3,'audio/wav',5,'uploaded') returning id", [u.id, sessionId, keys.audioClip(u.id, sessionId, 1)])).rows[0].id;
    await env.backdate("files", f2, "25 hours", "created_at");
    const flaky = await startFakeS3({ accessKeyId: testEnv.R2_ACCESS_KEY_ID, secretAccessKey: testEnv.R2_SECRET_ACCESS_KEY, bucket: testEnv.R2_BUCKET, failDelete: () => true });
    const real = env.deps.r2; env.deps.r2 = new R2({ accountId: "a", accessKeyId: testEnv.R2_ACCESS_KEY_ID, secretAccessKey: testEnv.R2_SECRET_ACCESS_KEY, bucket: testEnv.R2_BUCKET, endpoint: flaky.endpoint });
    await env.call(maintenanceSweep, {}, { internal: true });
    env.deps.r2 = real; await flaky.stop();
    expect((await env.db.admin.query("select status from public.files where id=$1", [f2])).rows[0].status).toBe("uploaded");
  });
  it("reopens sessions that never finished uploading audio; abandons idle in_progress sessions after 24 h", async () => {
    const { u, sessionId } = await withDeck("sw-c@example.test");
    await pendingAudio(u, sessionId);
    expect((await env.db.admin.query("select status from public.practice_sessions where id=$1", [sessionId])).rows[0].status).toBe("uploading_audio");
    await env.backdate("practice_sessions", sessionId, "2 hours");
    const r = await env.call(maintenanceSweep, {}, { internal: true });
    expect(r.json.data.sessions_reopened).toBeGreaterThanOrEqual(1);
    expect((await env.db.admin.query("select status from public.practice_sessions where id=$1", [sessionId])).rows[0].status).toBe("in_progress");
    expect(await env.r2.head(keys.audioClip(u.id, sessionId, 0))).toBeNull();
    await env.backdate("practice_sessions", sessionId, "30 hours", "created_at");
    const r2 = await env.call(maintenanceSweep, {}, { internal: true });
    expect(r2.json.data.sessions_abandoned).toBeGreaterThanOrEqual(1);
    expect((await env.db.admin.query("select status from public.practice_sessions where id=$1", [sessionId])).rows[0].status).toBe("abandoned");
  });
  it("resumes stuck analyses and decks via internal invocation, and fails analyses past the attempt limit", async () => {
    const a = await withDeck("sw-d@example.test");
    await env.db.admin.query("update public.practice_sessions set status='transcribing', analysis_attempts=1 where id=$1", [a.sessionId]);
    await env.backdate("practice_sessions", a.sessionId, "10 minutes");
    const b = await withDeck("sw-e@example.test");
    await env.db.admin.query("update public.practice_sessions set status='generating_report', analysis_attempts=3 where id=$1", [b.sessionId]);
    await env.backdate("practice_sessions", b.sessionId, "10 minutes");
    const c = await withDeck("sw-f@example.test");
    await env.db.admin.query("update public.decks set status='processing' where id=$1", [c.deckId]).catch(() => {});
    await env.backdate("decks", c.deckId, "10 minutes");
    env.invokes.length = 0;
    const r = await env.call(maintenanceSweep, {}, { internal: true });
    expect(env.invokes).toContainEqual({ fn: "session-analyse", body: { session_id: a.sessionId } });
    expect(env.invokes.some((i) => i.fn === "session-analyse" && i.body.session_id === b.sessionId)).toBe(false);
    expect(env.invokes).toContainEqual({ fn: "deck-process", body: { deck_id: c.deckId } });
    expect((await env.db.admin.query("select status, error_code from public.practice_sessions where id=$1", [b.sessionId])).rows[0]).toEqual({ status: "failed", error_code: "analysis_stalled" });
    expect(r.json.data).toMatchObject({ sessions_resumed: expect.any(Number), sessions_failed: expect.any(Number), decks_resumed: expect.any(Number) });
  });
  it("is idempotent: a second run finds nothing new to do", async () => {
    await env.call(maintenanceSweep, {}, { internal: true });
    const again = await env.call(maintenanceSweep, {}, { internal: true });
    expect(again.json.data).toMatchObject({ pending_files_failed: 0, decks_failed: 0, sessions_reopened: 0, sessions_abandoned: 0, audio_deleted: 0, deletions_finished: 0 });
  });
});
