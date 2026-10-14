// Runs the real Edge Function handlers against: a real Postgres (RLS + grants), a fake S3 that verifies SigV4, a fake NVIDIA.
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { createDb, completeProfile, acceptLatest, type Db } from "../db/harness";
import { makePgSupabase } from "../helpers/pg-supabase";
import { startFakeS3, type FakeS3 } from "../helpers/fake-s3";
import { R2 } from "@shared/r2.ts";
import { buildWav } from "@shared/files.ts";
import type { Deps } from "@shared/deps.ts";
import type { Env } from "@shared/env.ts";
import { TransportError, type TransportResult } from "@shared/nvidia/router.ts";
import type { Transcript } from "@shared/audio.ts";

export const SECRET = "internal-secret-0123456789";
export const ORIGIN = "http://localhost:3000";

export const testEnv: Env = {
  SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", INTERNAL_FUNCTION_SECRET: SECRET,
  APP_ALLOWED_ORIGINS: `${ORIGIN},https://m2p.netlify.app`, R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "AKIATEST", R2_SECRET_ACCESS_KEY: "sekrit", R2_BUCKET: "m2p-test",
  NVIDIA_SLIDE_MODEL: "slide-model", NVIDIA_REPORT_MODEL: "report-model", NVIDIA_ASR_FUNCTION_ID: "fn-asr", NVIDIA_ASR_MODEL_LABEL: "parakeet-test",
  NVIDIA_KEY_RPM_SOFT_LIMIT: 35, NVIDIA_KEY_DEFAULT_CREDIT_LIMIT: 1000,
  NVIDIA_SLIDE_KEY_PRIMARY: "slide-k0", NVIDIA_SLIDE_KEY_FALLBACK_1: "slide-k1", NVIDIA_SLIDE_KEY_FALLBACK_2: "slide-k2",
  NVIDIA_ASR_KEY_PRIMARY: "asr-k0", NVIDIA_ASR_KEY_FALLBACK_1: "asr-k1", NVIDIA_ASR_KEY_FALLBACK_2: "asr-k2",
  NVIDIA_REPORT_KEY_PRIMARY: "rep-k0", NVIDIA_REPORT_KEY_FALLBACK_1: "rep-k1", NVIDIA_REPORT_KEY_FALLBACK_2: "rep-k2",
  INTERNAL_TRANSCRIBE_URL: undefined, INTERNAL_TRANSCRIBE_SECRET: undefined,
};

/** Scriptable fake NVIDIA (chat + ASR). Behaviours can be overridden per test. */
export class FakeAi {
  chatCalls: { model: string; key: string; messages: any[] }[] = [];
  asrCalls: { key: string; bytes: number }[] = [];
  /** per-key forced HTTP status for chat calls (e.g. { "slide-k0": 429 }) */
  chatStatus: Record<string, number> = {};
  asrStatus: Record<string, number> = {};
  slideOut: (n: number, imageBytes: number) => unknown = (n) => ({ title: `Slide ${n}`, slide_text: "text", key_points: ["Point A", "Point B", "Point C"], suggested_script: "Say things.", time_weight: 10 + n });
  reportOut: ((slides: any[]) => unknown) | null = null;
  transcript: (pcmBytes: number) => Transcript = (b) => b === 0 ? { text: "", words: [] } : { text: "so um we built the system and it is really fast", words: [{ w: "so", start_ms: 0, end_ms: 100 }] };
  private slideCounter = 0;
  invalidReportOnce = false;

  fetchFn: typeof fetch = async (url, init) => {
    if (String(url).endsWith("/v1/models")) return new Response(JSON.stringify({ data: [{ id: "slide-model" }, { id: "report-model" }] }), { status: 200 });
    if (!init || !(init as RequestInit).body || (init as RequestInit).method === "PUT" || (init as RequestInit).method === "GET" || String(url).includes("r2") || String(url).includes("127.0.0.1")) return fetch(url, init); // storage traffic goes to the fake S3
    const body = JSON.parse(String((init as RequestInit).body));
    const key = String(((init as RequestInit).headers as Record<string, string>).Authorization).replace("Bearer ", "");
    this.chatCalls.push({ model: body.model, key, messages: body.messages });
    const forced = this.chatStatus[key];
    if (forced) return new Response(JSON.stringify({ error: "forced" }), { status: forced, headers: forced === 429 ? { "Retry-After": "30" } : {} });
    let content: unknown;
    const structuring = String(body.messages[0]?.content ?? "").includes("sends ONE slide image") && !Array.isArray(body.messages[1]?.content);
    if (structuring) content = this.slideOut(++this.slideCounter, 1500);
    else if (body.model === "slide-model") {
      const imgPart = (body.messages.find((m: any) => Array.isArray(m.content))?.content ?? []).find((c: any) => c.type === "image_url");
      const b64 = String(imgPart?.image_url?.url ?? "").split(",")[1] ?? "";
      content = this.slideOut(++this.slideCounter, Buffer.from(b64, "base64").length);
    }
    else {
      if (this.invalidReportOnce) { this.invalidReportOnce = false; content = "this is not json"; }
      else {
        let slides: any[] | null = null;
        try { slides = JSON.parse(body.messages[1].content).slides as any[]; } catch { /* a plain ping */ }
        content = !slides ? { ok: true } : this.reportOut ? this.reportOut(slides) : {
          slides: slides.map((s) => ({ slide_index: s.slide_index, key_points_covered: s.transcript.length > 20 ? s.key_points.map((_: string, i: number) => i) : [], key_points_missed: [], off_topic_quotes: ["quote that was never said"], feedback: "ok" })),
          clarity_score: 80, headline: "Strong start; tighten the middle", top_fixes: ["Slide 1: trim 10 seconds", "Slide 2: fewer fillers (3)", "Slide 3: add the missed point"], did_well: ["Slide 1: clear opening", "Slide 2: good pace", "Slide 3: strong close"],
        };
      }
    }
    const text = typeof content === "string" ? content : JSON.stringify(content);
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 11, completion_tokens: 7 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  asrProbe = async (_key: string, _t: number): Promise<string[]> => ["parakeet-fake"];

  asr = async ({ pcm, key }: { pcm: Uint8Array; key: string; timeoutMs: number }): Promise<TransportResult> => {
    this.asrCalls.push({ key, bytes: pcm.length });
    const forced = this.asrStatus[key];
    if (forced === -1) throw new TransportError("timeout");
    if (forced) return { status: forced, headers: forced === 429 ? { "retry-after": "30" } : {}, body: null };
    const silent = pcm.every((b) => b === 0); // a real ASR returns an empty transcript for silence
    return { status: 200, headers: {}, body: silent ? { text: "", words: [] } : this.transcript(pcm.length), usage: { audioMs: Math.round(pcm.length / 32) } };
  };
}

export type Env_ = Awaited<ReturnType<typeof createEnv>>;

export async function createEnv() {
  const db = await createDb();
  const s3 = await startFakeS3({ accessKeyId: testEnv.R2_ACCESS_KEY_ID, secretAccessKey: testEnv.R2_SECRET_ACCESS_KEY, bucket: testEnv.R2_BUCKET, corsOrigins: [ORIGIN, "https://m2p.netlify.app"] });
  const ai = new FakeAi();
  const r2 = new R2({ accountId: "acct", accessKeyId: testEnv.R2_ACCESS_KEY_ID, secretAccessKey: testEnv.R2_SECRET_ACCESS_KEY, bucket: testEnv.R2_BUCKET, endpoint: s3.endpoint });
  const tokens = new Map<string, string>(); // jwt -> uid
  const pending: Promise<unknown>[] = [];
  const invokes: { fn: string; body: Record<string, unknown> }[] = [];
  const state = { now: () => new Date() };
  const deps: Deps = {
    env: testEnv,
    userClient: (jwt) => makePgSupabase(db.admin, { role: "authenticated", uid: tokens.get(jwt) }, { users: tokens }),
    admin: makePgSupabase(db.admin, { role: "service_role" }, { onDeleteUser: async (id) => { await db.admin.query("delete from auth.users where id=$1", [id]); } }),
    r2, fetchFn: ai.fetchFn, asr: ai.asr, asrProbe: ai.asrProbe, now: () => state.now(),
    background: (p) => { pending.push(p.catch(() => {})); },
    invoke: async (fn, body) => { invokes.push({ fn, body }); },
  };
  return {
    db, s3, ai, r2, deps, invokes, state,
    /** wait for all background work started so far */
    settle: async () => { let n = 0; while (pending.length && n++ < 50) { const batch = pending.splice(0); await Promise.all(batch); } },
    async user(email: string, o: { complete?: boolean; accept?: boolean; name?: string } = {}) {
      const id = await db.makeUser(email, { name: o.name });
      if (o.complete !== false) await completeProfile(db, id);
      if (o.accept !== false) await acceptLatest(db, id);
      const token = `jwt-${randomUUID()}`;
      tokens.set(token, id);
      return { id, token, email };
    },
    async admin_(email = "owner@mock2pitch.test") {
      const id = await db.makeUser(email); const token = `jwt-${randomUUID()}`; tokens.set(token, id);
      return { id, token, email };
    },
    call: (handler: (req: Request, deps: Deps) => Promise<Response>, body: unknown, o: { token?: string | null; origin?: string; internal?: boolean; method?: string; raw?: string } = {}) => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (o.token) headers.Authorization = `Bearer ${o.token}`;
      if (o.origin) headers.Origin = o.origin;
      if (o.internal) headers["x-internal-secret"] = SECRET;
      const method = o.method ?? "POST";
      return handler(new Request("http://fn.local/x", { method, headers, body: method === "POST" ? (o.raw ?? JSON.stringify(body)) : undefined }), deps)
        .then(async (r) => { const text = await r.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* empty */ } return { status: r.status, json, headers: r.headers, text }; });
    },
    /** Backdate a row (bypasses the updated_at trigger). */
    async backdate(table: string, id: string, interval: string, col = "updated_at") {
      await db.admin.query(`set local session_replication_role = replica; update public.${table} set ${col} = now() - interval '${interval}' where id = '${id}'`);
    },
    async close() { await s3.stop(); await db.close(); },
  };
}

// ---------------------------------------------------------------- fixtures
export async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([400, 300]);
  return doc.save();
}
/** Hand-written PDF whose trailer carries an /Encrypt entry (pdf-lib refuses to load these). */
export function encryptedPdf(): Uint8Array {
  const s = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >> endobj
4 0 obj << /Filter /Standard /V 1 /R 2 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) /P -4 >> endobj
trailer << /Root 1 0 R /Size 5 /Encrypt 4 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>] >>
%%EOF
`;
  return new TextEncoder().encode(s);
}
export function jpeg(size = 2000): Uint8Array { const b = new Uint8Array(size); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xe0; return b; }
/** n seconds of 16 kHz mono 16-bit PCM (a quiet tone so it isn't all-zero) as a WAV. */
export function wav(seconds: number, silent = false): Uint8Array {
  const pcm = new Uint8Array(Math.round(seconds * 32000));
  if (!silent) for (let i = 0; i < pcm.length; i += 2) pcm[i] = (i / 2) % 50;
  return buildWav(pcm);
}

export async function put(url: string, headers: Record<string, string>, body: Uint8Array) {
  const h: Record<string, string> = {};
  if (headers["Content-Type"]) h["Content-Type"] = headers["Content-Type"];
  return fetch(url, { method: "PUT", body: body as unknown as BodyInit, headers: h });
}

/** Drive the full happy-path deck upload for a user; returns ids. */
export async function uploadDeck(env: Env_, u: { token: string }, handlers: { init: any; complete: any; process: any }, pdf: Uint8Array, filename = "ParkSense.pdf"): Promise<{ init: any; putRes: Response; complete: any; deckId: string }> {
  const init = await env.call(handlers.init, { filename, size_bytes: pdf.length, content_type: "application/pdf" }, { token: u.token });
  if (init.status !== 200) throw new Error(`deck-upload-init failed: ${init.status} ${init.text}`);
  const up = init.json.data.upload;
  const putRes = await put(up.url, up.headers, pdf);
  const complete = await env.call(handlers.complete, { deck_id: init.json.data.deck_id }, { token: u.token });
  return { init, putRes, complete, deckId: init.json.data.deck_id as string };
}
export type { Db, FakeS3 };
