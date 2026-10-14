// Internal-only operational self-test. Runs REAL checks against the services configured for this deployment (R2, NVIDIA,
// the database and the full deck/session pipeline with a throw-away synthetic user) and reports pass/fail per step.
// It never returns secrets, presigned URLs or user data; details are limited to status codes, timings and synthetic content.
import { z } from "zod";
import { api, AppError, isInternal, readBody } from "./common.ts";
import { ok } from "../http.ts";
import type { Ctx, Deps } from "../deps.ts";
import { PURPOSES, SLIDE_IMAGE_MAX_BYTES } from "../constants.ts";
import { keysFor, modelFor } from "../env.ts";
import { keys } from "../r2.ts";
import { chatText, parseJsonLoose, NVIDIA_CHAT_URL } from "../nvidia/chat.ts";
import { slideReadingOut } from "../schemas.ts";
import { SLIDE_READING_SYSTEM, SLIDE_READING_USER } from "../prompts/slide-reading.ts";
import { toBase64 } from "../ai/base64.ts";
import { pcmOf } from "../audio.ts";
import { countFillers } from "../scoring.ts";
import { fromB64, SLIDE_JPEG_B64, SPEECH_TEXT, SPEECH_WAV_B64 } from "../selftest/fixtures.ts";
import { deckProcess } from "./deck-process.ts";
import { sessionAnalyse } from "./session-analyse.ts";

const modelId = z.string().regex(/^[\w./:-]{3,100}$/);
const bodySchema = z.object({ check: z.enum(["env", "r2", "nvidia", "nvidia_models", "nvidia_report", "nvidia_slide", "nvidia_asr", "pipeline"]), slide_model: modelId.optional(), report_model: modelId.optional() }).strict();
type Step = { name: string; ok: boolean; ms: number; detail?: unknown };

const BUDGET_MS = 110_000; // the Edge Function wall-clock limit is ~150 s; stop starting new steps after this

class Steps {
  steps: Step[] = [];
  private started = Date.now();
  async run(name: string, fn: () => Promise<{ ok: boolean; detail?: unknown } | void>): Promise<void> {
    if (Date.now() - this.started > BUDGET_MS) { this.steps.push({ name, ok: false, ms: 0, detail: "skipped: time budget used up (run this check again on its own)" }); return; }
    const t0 = Date.now();
    try {
      const r = (await fn()) ?? { ok: true };
      this.steps.push({ name, ok: r.ok, ms: Date.now() - t0, ...(r.detail !== undefined ? { detail: r.detail } : {}) });
    } catch (e) {
      // Only the error class and a short message built by our own code; never upstream bodies.
      this.steps.push({ name, ok: false, ms: Date.now() - t0, detail: { error: (e as Error)?.name ?? "Error", message: String((e as Error)?.message ?? "").slice(0, 160) } });
    }
  }
  get allOk() { return this.steps.every((s) => s.ok); }
}

const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]! : null; };

export const opsSelftest = api(async (ctx) => {
  if (!isInternal(ctx.req, ctx.deps)) throw new AppError("forbidden", 403, "You can't do that.");
  const body = await readBody(ctx.req, bodySchema);
  const { check } = body;
  // Optional model overrides let an operator try a candidate model without changing the stored secrets.
  const deps: Deps = { ...ctx.deps, env: { ...ctx.deps.env, ...(body.slide_model ? { NVIDIA_SLIDE_MODEL: body.slide_model } : {}), ...(body.report_model ? { NVIDIA_REPORT_MODEL: body.report_model } : {}) } };
  const s = new Steps();
  if (check === "env") await envCheck({ ...ctx, deps }, s);
  else if (check === "r2") await r2Check(deps, s);
  else if (check === "nvidia" || check.startsWith("nvidia_")) await nvidiaCheck(deps, s, check === "nvidia" ? "all" : check.slice(7) as "models" | "report" | "slide" | "asr");
  else await pipelineCheck(deps, s);
  return ok({ check, ok: s.allOk, steps: s.steps });
});

// ---------------------------------------------------------------- env
async function envCheck(ctx: Ctx, s: Steps) {
  const { env } = ctx.deps;
  await s.run("required variables present (validated at boot)", async () => ({ ok: true, detail: { r2_bucket: env.R2_BUCKET, allowed_origins: env.APP_ALLOWED_ORIGINS.split(",").map((x) => x.trim()), asr_function_id_set: !!env.NVIDIA_ASR_FUNCTION_ID, transcribe_route: env.INTERNAL_TRANSCRIBE_URL ? "next-route (option B)" : "in-process grpc (option A)" } }));
  await s.run("key slots configured per purpose", async () => {
    const detail: Record<string, string[]> = {};
    for (const p of PURPOSES) detail[p] = keysFor(env, p).map((k) => k.slot);
    return { ok: PURPOSES.every((p) => (detail[p] ?? []).includes("primary")), detail };
  });
  await s.run("models (after any override)", async () => ({ ok: true, detail: { slide_reading: env.NVIDIA_SLIDE_MODEL, report_generation: env.NVIDIA_REPORT_MODEL, speech_to_text: env.NVIDIA_ASR_MODEL_LABEL } }));
  await s.run("database reachable and migrated", async () => {
    const { data, error } = await ctx.deps.admin.from("ai_key_slots").select("id");
    if (error) throw new Error("db_query_failed");
    return { ok: (data ?? []).length === 9, detail: { key_slots: (data ?? []).length } };
  });
}

// ---------------------------------------------------------------- R2
async function r2Check(deps: Deps, s: Steps) {
  const { r2, fetchFn } = deps;
  const id = crypto.randomUUID();
  const base = `healthcheck/${id}`;
  const body = new TextEncoder().encode("mock2pitch selftest");
  const origins = deps.env.APP_ALLOWED_ORIGINS.split(",").map((x) => x.trim()).filter(Boolean);

  await s.run("server-side put/head/get/delete roundtrip", async () => {
    await r2.put(`${base}/a.txt`, body, "text/plain");
    const head = await r2.head(`${base}/a.txt`);
    const got = await r2.get(`${base}/a.txt`);
    await r2.delete(`${base}/a.txt`);
    const gone = await r2.head(`${base}/a.txt`);
    return { ok: head?.size === body.length && got.length === body.length && gone === null, detail: { size: head?.size } };
  });
  await s.run("presigned PUT with exact type + length is accepted", async () => {
    const p = await r2.presignPut(`${base}/b.txt`, { contentType: "text/plain", contentLength: body.length, expiresS: 120 });
    const res = await fetchFn(p.url, { method: "PUT", headers: { "Content-Type": "text/plain" }, body });
    const head = await r2.head(`${base}/b.txt`);
    return { ok: res.status === 200 && head?.size === body.length, detail: { status: res.status } };
  });
  await s.run("presigned PUT with a different Content-Type is rejected", async () => {
    const p = await r2.presignPut(`${base}/c.txt`, { contentType: "text/plain", contentLength: body.length, expiresS: 120 });
    const res = await fetchFn(p.url, { method: "PUT", headers: { "Content-Type": "text/html" }, body });
    const head = await r2.head(`${base}/c.txt`);
    return { ok: res.status >= 400 && head === null, detail: { status: res.status, object_created: head !== null } };
  });
  await s.run("presigned PUT with a longer body than the signed Content-Length is rejected", async () => {
    const p = await r2.presignPut(`${base}/d.txt`, { contentType: "text/plain", contentLength: body.length, expiresS: 120 });
    const res = await fetchFn(p.url, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: new Uint8Array(body.length * 4) });
    const head = await r2.head(`${base}/d.txt`);
    return { ok: res.status >= 400 && head === null, detail: { status: res.status, object_created: head !== null, size: head?.size ?? null } };
  });
  await s.run("presigned GET works; the unsigned URL is denied", async () => {
    const g = await r2.presignGet(`${base}/b.txt`, 120);
    const signed = await fetchFn(g.url);
    const unsigned = await fetchFn(g.url.split("?")[0]!);
    await signed.arrayBuffer(); await unsigned.arrayBuffer();
    return { ok: signed.status === 200 && unsigned.status >= 400, detail: { signed: signed.status, unsigned: unsigned.status } };
  });
  await s.run("CORS preflight: allowed origins pass, a foreign origin does not", async () => {
    const p = await r2.presignPut(`${base}/e.txt`, { contentType: "image/jpeg", expiresS: 120 });
    const detail: Record<string, unknown> = {};
    let allOk = origins.length > 0;
    for (const o of origins) {
      const r = await fetchFn(p.url, { method: "OPTIONS", headers: { Origin: o, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" } });
      await r.arrayBuffer();
      const allowed = r.headers.get("access-control-allow-origin");
      detail[o] = { status: r.status, allow_origin: allowed };
      if (!(r.status < 300 && (allowed === o || allowed === "*"))) allOk = false;
    }
    const evil = await fetchFn(p.url, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "PUT" } });
    await evil.arrayBuffer();
    const evilAllowed = evil.headers.get("access-control-allow-origin");
    detail["https://evil.example"] = { status: evil.status, allow_origin: evilAllowed };
    return { ok: allOk && !evilAllowed, detail };
  });
  await s.run("prefix delete removes every object under a prefix", async () => {
    for (let i = 0; i < 3; i++) await r2.put(`${base}/p/${i}.bin`, new Uint8Array([i]), "application/octet-stream");
    const n = await r2.deletePrefix(`${base}/`);
    const left = await r2.list(`${base}/`);
    return { ok: n >= 3 && left.length === 0, detail: { deleted: n, left: left.length } };
  });
}

// ---------------------------------------------------------------- NVIDIA
const MODELS_URL = (chatUrl: string) => chatUrl.replace(/\/chat\/completions$/, "/models");

async function nvidiaCheck(deps: Deps, s: Steps, part: "all" | "models" | "report" | "slide" | "asr" = "all") {
  const { env } = deps;
  const want = (p: string) => part === "all" || part === p;
  // every upstream call gets its own timeout so a slow model cannot hang the whole check
  const fetchFn: typeof fetch = (input, init) => deps.fetchFn(input, { ...(init ?? {}), signal: AbortSignal.timeout(40_000) });
  const jpeg = fromB64(SLIDE_JPEG_B64);

  const listed = new Map<string, Set<string>>(); // key -> ids
  for (const purpose of want("models") ? PURPOSES : []) {
    for (const { slot, key } of keysFor(env, purpose)) {
      await s.run(`${purpose}/${slot}: key accepted by /v1/models`, async () => {
        const res = await fetchFn(MODELS_URL(NVIDIA_CHAT_URL), { headers: { Authorization: `Bearer ${key}` } });
        let ids = new Set<string>();
        try { const j = await res.json(); ids = new Set((j.data ?? []).map((m: { id: string }) => m.id)); } catch { /* not json */ }
        listed.set(key, ids);
        const model = purpose === "speech_to_text" ? null : modelFor(env, purpose);
        return { ok: res.status === 200 && (model === null || ids.has(model)), detail: { status: res.status, models_listed: ids.size, configured_model_listed: model === null ? "n/a" : ids.has(model) } };
      });
    }
  }

  const reportKey = keysFor(env, "report_generation")[0]?.key;
  const slideKey = keysFor(env, "slide_reading")[0]?.key;
  const chat = async (key: string, model: string, messages: unknown[], extra: Record<string, unknown> = {}) => {
    const t0 = Date.now();
    const res = await fetchFn(NVIDIA_CHAT_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, max_tokens: 24, temperature: 0, stream: false, ...extra }) });
    let json: any = null; try { json = await res.json(); } catch { /* ignore */ }
    return { status: res.status, ms: Date.now() - t0, json, retryAfter: res.headers.get("retry-after") };
  };

  if (reportKey && want("report")) {
    await s.run("report model: 5 small calls (latency, usage fields)", async () => {
      const lat: number[] = []; const statuses: number[] = []; let usage = false;
      for (let i = 0; i < 5; i++) { const r = await chat(reportKey, env.NVIDIA_REPORT_MODEL, [{ role: "user", content: 'Reply with exactly {"ok":true}' }]); lat.push(r.ms); statuses.push(r.status); usage = usage || !!r.json?.usage?.prompt_tokens; }
      return { ok: statuses.every((x) => x === 200), detail: { statuses, p50_ms: pct(lat, 50), p95_ms: pct(lat, 95), usage_fields: usage } };
    });
    await s.run("report model accepts response_format json_object", async () => {
      const r = await chat(reportKey, env.NVIDIA_REPORT_MODEL, [{ role: "user", content: 'Return the JSON {"ok":true}' }], { response_format: { type: "json_object" } });
      return { ok: true, detail: { status: r.status, supported: r.status === 200 } }; // informational: we do not send it today
    });
  }
  if (slideKey && want("slide")) {
    await s.run("slide model: reads the fixture slide (3 calls, schema-valid)", async () => {
      const lat: number[] = []; let valid = 0; const statuses: number[] = []; let sample = ""; const loopStart = Date.now();
      const rejected: { issues: string[]; raw_head: string }[] = [];
      for (let i = 0; i < 3 && Date.now() - loopStart < 80_000; i++) {
        const r = await chat(slideKey, env.NVIDIA_SLIDE_MODEL, [{ role: "system", content: SLIDE_READING_SYSTEM }, { role: "user", content: [{ type: "text", text: SLIDE_READING_USER }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}` } }] }], { max_tokens: 1200 });
        lat.push(r.ms); statuses.push(r.status);
        let rawText = "";
        try { rawText = chatText(r.json); const out = slideReadingOut.parse(parseJsonLoose(rawText)); valid++; sample = out.title; }
        catch (e) {
          // synthetic fixture content only: safe to show a short head of the model's answer and which fields failed
          const issues = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues?.map((i) => `${i.path.join(".")}: ${i.message}`.slice(0, 80)) ?? [String((e as Error)?.message ?? "parse_failed").slice(0, 80)];
          rejected.push({ issues: issues.slice(0, 4), raw_head: rawText.slice(0, 240) });
        }
      }
      return { ok: valid === statuses.length && statuses.length > 0, detail: { statuses, schema_valid: `${valid}/${statuses.length}`, p50_ms: pct(lat, 50), p95_ms: pct(lat, 95), sample_title: sample, ...(rejected.length ? { rejected: rejected.slice(0, 2) } : {}) } };
    });
    await s.run("slide model: inline image size probe (decides SLIDE_IMAGE_MAX_BYTES)", async () => {
      const results: Record<string, number> = {}; const loopStart = Date.now();
      for (const kb of [100, 200, 400, 800, 1600]) {
        if (Date.now() - loopStart > 80_000) { results["stopped"] = -1; break; }
        const padded = new Uint8Array(jpeg.length + kb * 1024); padded.set(jpeg);
        const r = await chat(slideKey, env.NVIDIA_SLIDE_MODEL, [{ role: "user", content: [{ type: "text", text: "Reply with the word ok." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(padded)}` } }] }], { max_tokens: 5 });
        results[`${Math.round(padded.length / 1024)}KB`] = r.status;
        if (r.status >= 400) break; // stop at the first refusal
      }
      return { ok: true, detail: { http_status_by_image_size: results, current_limit_bytes: SLIDE_IMAGE_MAX_BYTES } };
    });
  }

  const asrKey = keysFor(env, "speech_to_text")[0]?.key;
  if (asrKey && want("asr")) {
    await s.run("speech-to-text over gRPC (3 calls) and filler retention", async () => {
      const pcm = pcmOf(fromB64(SPEECH_WAV_B64));
      const lat: number[] = []; const statuses: number[] = []; let text = "";
      const loopStart = Date.now();
      for (let i = 0; i < 3 && Date.now() - loopStart < 80_000; i++) {
        const t0 = Date.now();
        let r;
        try { r = await deps.asr({ pcm, key: asrKey, timeoutMs: 45_000 }); }
        catch (e) { return { ok: false, detail: { transport_error: (e as { kind?: string }).kind ?? "unknown", reason: (e as { detail?: string }).detail ?? String((e as Error)?.message ?? "").slice(0, 200), calls_ok_before_failure: statuses.filter((x) => x === 200).length } }; }
        lat.push(Date.now() - t0); statuses.push(r.status);
        if (r.status === 200) text = (r.body as { text: string }).text;
      }
      const sent = countFillers(SPEECH_TEXT).total;
      const got = countFillers(text);
      return { ok: statuses.every((x) => x === 200) && text.length > 10, detail: { statuses, p50_ms: pct(lat, 50), p95_ms: pct(lat, 95), audio_seconds: Math.round(pcm.length / 32000), transcript: text, fillers_in_script: sent, fillers_kept_by_asr: got.total, kept: got.fillers } };
    });
  }
}

// ---------------------------------------------------------------- full pipeline with a synthetic user
async function pipelineCheck(deps0: Deps, s: Steps) {
  const tasks: Promise<unknown>[] = [];
  const deps: Deps = { ...deps0, background: (p) => { tasks.push(p.catch(() => {})); } };
  const { admin, r2, env } = deps;
  const settle = async () => { while (tasks.length) await Promise.all(tasks.splice(0)); };
  const internalReq = (body: unknown) => new Request("http://selftest.local/x", { method: "POST", headers: { "Content-Type": "application/json", "x-internal-secret": env.INTERNAL_FUNCTION_SECRET }, body: JSON.stringify(body) });
  const call = async (h: (r: Request, d: Deps) => Promise<Response>, body: unknown) => { const r = await h(internalReq(body), deps); return { status: r.status, json: await r.json().catch(() => null) as any }; };

  let uid: string | null = null;
  const deckId = crypto.randomUUID(); const sessionId = crypto.randomUUID();
  try {
    await s.run("create synthetic user (profile created by trigger)", async () => {
      const email = `selftest-${Date.now()}@mock2pitch.test`;
      const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "Selftest" } });
      if (error || !data?.user?.id) throw new Error("create_user_failed");
      uid = data.user.id as string;
      const { data: p } = await admin.from("profiles").select("role, email").eq("id", uid).maybeSingle();
      await admin.from("profiles").update({ college: "Selftest College", year: "3rd year", branch: "CSE" }).eq("id", uid);
      const { data: v } = await admin.from("policy_versions").select("id").order("published_at", { ascending: false }).limit(1).maybeSingle();
      if (v) await admin.from("policy_acceptances").insert({ user_id: uid, policy_version_id: v.id });
      return { ok: p?.role === "student", detail: { profile_created: !!p, role: p?.role } };
    });
    if (!uid) return;
    const userId: string = uid;

    await s.run("deck upload completion (daily session consumed atomically) + 2 slide images in R2", async () => {
      await admin.from("decks").insert({ id: deckId, owner_id: userId, title: "Selftest deck", original_filename: "selftest.pdf", status: "awaiting_upload" });
      await admin.from("files").insert({ owner_id: userId, deck_id: deckId, kind: "deck_pdf", bucket: r2.bucket, object_key: keys.deckPdf(userId, deckId), mime_type: "application/pdf", expected_size_bytes: 100, status: "pending" });
      const imgs = [0, 1].map((i) => ({ slide_index: i, bucket: r2.bucket, object_key: keys.slideImage(userId, deckId, i), expected_size_bytes: SLIDE_IMAGE_MAX_BYTES }));
      const { error } = await admin.rpc("svc_complete_deck_upload", { p_deck_id: deckId, p_page_count: 2, p_pdf_size: 100, p_images: imgs });
      if (error) throw new Error(`rpc_failed:${error.message}`);
      for (const i of [0, 1]) await r2.put(keys.slideImage(userId, deckId, i), fromB64(SLIDE_JPEG_B64), "image/jpeg");
      const { data: used } = await admin.from("usage_events").select("id").eq("user_id", userId);
      return { ok: (used ?? []).length === 1, detail: { sessions_consumed_today: (used ?? []).length } };
    });

    await s.run("deck-process: vision model reads both slides -> deck ready", async () => {
      const r = await call(deckProcess, { deck_id: deckId });
      await settle();
      const { data: deck } = await admin.from("decks").select("status, error_code, processed_slides").eq("id", deckId).single();
      const { data: slides } = await admin.from("slides").select("slide_index, title, key_points, time_weight").eq("deck_id", deckId).order("slide_index", { ascending: true });
      return { ok: r.status === 202 && deck?.status === "ready" && (slides ?? []).length === 2, detail: { http: r.status, status: deck?.status, error_code: deck?.error_code, slides: (slides ?? []).map((x: any) => ({ title: x.title, key_points: x.key_points.length, weight: x.time_weight })) } };
    });

    await s.run("session prepared with one recorded clip (slide 2 left unrecorded)", async () => {
      await admin.from("practice_sessions").insert({ id: sessionId, deck_id: deckId, owner_id: userId, attempt_number: 1, total_minutes: 1, suggested_seconds: [30, 30], status: "uploading_audio", submitted_at: new Date().toISOString() });
      const wav = fromB64(SPEECH_WAV_B64);
      const key = keys.audioClip(userId, sessionId, 0);
      await admin.from("files").insert({ owner_id: userId, session_id: sessionId, kind: "audio_clip", slide_index: 0, bucket: r2.bucket, object_key: key, mime_type: "audio/wav", expected_size_bytes: wav.length, status: "pending" });
      await r2.put(key, wav, "audio/wav");
      return { ok: (await r2.head(key))?.size === wav.length, detail: { clip_bytes: wav.length } };
    });

    await s.run("session-analyse: transcribe -> metrics -> report -> finalise -> audio deleted", async () => {
      const r = await call(sessionAnalyse, { session_id: sessionId });
      await settle();
      const { data: sess } = await admin.from("practice_sessions").select("status, error_code, analysis_attempts").eq("id", sessionId).single();
      const { data: rep } = await admin.from("reports").select("overall_score, coverage_score, clarity_score, timing_score, filler_score, overall_wpm, filler_total, key_points_covered, key_points_total, scoring_version, headline").eq("session_id", sessionId).maybeSingle();
      const { data: res } = await admin.from("session_slide_results").select("slide_index, transcript, duration_ms, filler_count, key_points_covered").eq("session_id", sessionId).order("slide_index", { ascending: true });
      const audioLeft = await r2.head(keys.audioClip(userId, sessionId, 0));
      const { data: f } = await admin.from("files").select("status").eq("session_id", sessionId);
      const formula = rep ? Math.round(0.35 * rep.coverage_score + 0.25 * rep.clarity_score + 0.2 * rep.timing_score + 0.2 * rep.filler_score) : null;
      return {
        ok: r.status === 202 && sess?.status === "completed" && !!rep && formula === rep.overall_score && audioLeft === null && (f ?? []).every((x: any) => x.status === "deleted"),
        detail: { http: r.status, session: sess, report: rep, formula_matches: formula === rep?.overall_score, audio_deleted: audioLeft === null, transcript: res?.[0]?.transcript, unrecorded_slide_has_row: (res ?? []).some((x: any) => x.slide_index === 1) },
      };
    });

    await s.run("usage log recorded every NVIDIA call (no prompts / keys)", async () => {
      const { data } = await admin.from("ai_usage_log").select("purpose, outcome, http_status, latency_ms").in("deck_id", [deckId]);
      const { data: data2 } = await admin.from("ai_usage_log").select("purpose, outcome, http_status, latency_ms").eq("session_id", sessionId);
      const rows = [...(data ?? []), ...(data2 ?? [])];
      const by: Record<string, number> = {};
      for (const r of rows) by[`${r.purpose}:${r.outcome}`] = (by[`${r.purpose}:${r.outcome}`] ?? 0) + 1;
      return { ok: rows.length >= 4, detail: by };
    });
  } finally {
    await s.run("cleanup: delete synthetic user (cascade) and every R2 object", async () => {
      if (uid) {
        await admin.auth.admin.deleteUser(uid);
        const n = await r2.deletePrefix(keys.userPrefix(uid));
        const { data: left } = await admin.from("decks").select("id").eq("id", deckId);
        const { data: prof } = await admin.from("profiles").select("id").eq("id", uid);
        return { ok: (left ?? []).length === 0 && (prof ?? []).length === 0 && (await r2.list(keys.userPrefix(uid))).length === 0, detail: { r2_objects_removed: n } };
      }
      return { ok: true, detail: "nothing to clean" };
    });
  }
}

