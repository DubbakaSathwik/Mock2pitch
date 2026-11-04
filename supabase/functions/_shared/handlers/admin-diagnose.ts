// Owner-only API diagnosis: sends a preset (or the owner's own) input to one service and reports what came back, how long it took, whether
// it matches what was expected, and, if it failed, the reason in plain words. Never returns keys (only the slot and the last 4 characters).
// These are real calls and spend provider credits; the owner decides how often to run them.
import { z } from "zod";
import { api, AppError, ok, readBody, requireUser } from "./common.ts";
import { maskKey } from "./admin-ai-keys.ts";
import { keysFor, modelFor } from "../env.ts";
import { SLOTS } from "../constants.ts";
import { chatText, GEMINI_CHAT_URL, NVIDIA_CHAT_URL, parseJsonLoose } from "../nvidia/chat.ts";
import { deckReadingOut } from "../schemas.ts";
import { DECK_READING_SYSTEM, buildDeckReadingUser } from "../prompts/deck-reading.ts";
import { pcmOf } from "../audio.ts";
import { toBase64 } from "../ai/base64.ts";
import { fromB64, SLIDE_JPEG_B64, SPEECH_TEXT, SPEECH_WAV_B64 } from "../selftest/fixtures.ts";
import { classifyHttp, classifyThrown, containsCheck, notConfigured, redact, upstreamMessage, wordOverlap, type Failure } from "../diagnose.ts";
import type { Deps } from "../deps.ts";

const TARGETS = ["gemini_slide", "nvidia_report", "nvidia_asr", "storage", "database"] as const;
type Target = (typeof TARGETS)[number];
const bodySchema = z.object({
  target: z.enum(TARGETS),
  mode: z.enum(["preset", "custom"]).default("preset"),
  prompt: z.string().trim().max(4000).optional(),
  expect: z.string().trim().max(500).optional(),
  model: z.string().regex(/^[\w./:-]{3,100}$/).optional(),
  slot: z.enum(SLOTS).optional(),
  include_image: z.boolean().optional(),
}).strict();

export type Check = { name: string; ok: boolean; detail?: string };
export type DiagnosisResult = {
  target: Target; mode: "preset" | "custom"; ran_at: string; ok: boolean; verdict: "pass" | "fail" | "unchecked";
  ms: number; http_status: number | null; model: string | null; key: { slot: string; masked: string } | null;
  request: string; expected: string; actual: string; checks: Check[]; error: Failure | null;
};

const TIMEOUT_MS = 60_000;
const clip = (s: string, n = 4000) => (s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} more characters)` : s);

export const adminDiagnose = api(async (ctx) => {
  const a = await requireUser(ctx);
  const { deps } = ctx;
  const { data: isAdmin } = await a.userClient.rpc("is_admin");
  if (isAdmin !== true) throw new AppError("forbidden", 403, "You can't do that.");
  const body = await readBody(ctx.req, bodySchema);
  return ok(await diagnose(deps, body));
});

export async function diagnose(deps: Deps, input: z.infer<typeof bodySchema>): Promise<DiagnosisResult> {
  const base = { target: input.target, mode: input.mode, ran_at: deps.now().toISOString() };
  const t0 = Date.now();
  const fin = (r: Partial<DiagnosisResult> & Pick<DiagnosisResult, "request" | "expected" | "actual">): DiagnosisResult => {
    const checks = r.checks ?? [];
    const failed = !!r.error || checks.some((c) => !c.ok);
    const verdict: DiagnosisResult["verdict"] = r.error ? "fail" : checks.length === 0 ? "unchecked" : failed ? "fail" : "pass";
    return { ...base, ok: verdict !== "fail", verdict, ms: Date.now() - t0, http_status: null, model: null, key: null, checks, error: null, ...r } as DiagnosisResult;
  };
  try {
    if (input.target === "database") return await dbCheck(deps, fin);
    if (input.target === "storage") return await storageCheck(deps, fin);
    if (input.target === "nvidia_asr") return await asrCheck(deps, input, fin);
    return await chatCheck(deps, input, fin);
  } catch (e) {
    return fin({ request: "", expected: "", actual: "", error: classifyThrown(e, TIMEOUT_MS) });
  }
}

type Fin = (r: Partial<DiagnosisResult> & Pick<DiagnosisResult, "request" | "expected" | "actual">) => DiagnosisResult;

async function dbCheck(deps: Deps, fin: Fin): Promise<DiagnosisResult> {
  const { data, error } = await deps.admin.from("ai_key_slots").select("id");
  const n = (data ?? []).length;
  if (error) return fin({ request: "select id from ai_key_slots", expected: "9 key slots", actual: "", error: { kind: "other", reason: "The database query failed.", hint: "Check the project is running and the migrations are applied.", upstream: redact(String(error.message ?? "")).slice(0, 300) } });
  return fin({ request: "select id from ai_key_slots", expected: "9 key slots (3 purposes × 3 slots)", actual: `${n} key slots`, checks: [{ name: "database reachable", ok: true }, { name: "migrated (9 key slots)", ok: n === 9, detail: `${n} found` }] });
}

async function storageCheck(deps: Deps, fin: Fin): Promise<DiagnosisResult> {
  const key = `healthcheck/diagnosis-${crypto.randomUUID()}.txt`;
  const payload = new TextEncoder().encode("mock2pitch diagnosis");
  try {
    await deps.r2.put(key, payload, "text/plain");
    const head = await deps.r2.head(key);
    const got = await deps.r2.get(key);
    await deps.r2.delete(key);
    const gone = await deps.r2.head(key);
    return fin({
      request: "put → head → get → delete one small object", expected: "the same 20 bytes come back and the object is gone afterwards", actual: `stored ${head?.size ?? 0} bytes, read ${got.length} bytes, deleted: ${gone === null}`,
      checks: [{ name: "write", ok: head?.size === payload.length }, { name: "read back", ok: got.length === payload.length }, { name: "delete", ok: gone === null }],
    });
  } catch (e) {
    await deps.r2.delete(key).catch(() => {});
    return fin({ request: "put → head → get → delete one small object", expected: "round trip succeeds", actual: "", error: { kind: "other", reason: "Cloudflare R2 refused or failed the request.", hint: "Check R2_ACCOUNT_ID, access key, secret and bucket name, and the token's permissions.", upstream: redact(String((e as Error)?.message ?? "")).slice(0, 300) } });
  }
}

function pickKey(deps: Deps, purpose: "slide_reading" | "report_generation" | "speech_to_text", slot?: string) {
  const keys = keysFor(deps.env, purpose);
  const k = slot ? keys.find((x) => x.slot === slot) : keys[0];
  return k ? { ...k, masked: maskKey(k.key) } : null;
}

async function chatCheck(deps: Deps, input: z.infer<typeof bodySchema>, fin: Fin): Promise<DiagnosisResult> {
  const gem = input.target === "gemini_slide";
  const purpose = gem ? "slide_reading" : "report_generation";
  const provider = gem ? "Gemini" : "NVIDIA";
  const k = pickKey(deps, purpose, input.slot);
  const model = input.model ?? modelFor(deps.env, purpose);
  if (!k) return fin({ request: "", expected: "", actual: "", model, error: notConfigured(input.slot ? `The ${input.slot} key for ${provider}` : `A ${provider} key`) });
  const custom = input.mode === "custom";
  const image = gem && (custom ? !!input.include_image : true);
  const jpeg = fromB64(SLIDE_JPEG_B64);

  let messages: unknown[];
  let request: string;
  let expected: string;
  if (gem && !custom) {
    request = "The real slide-reading prompt (audience: student, 1 minute) with a sample slide image";
    expected = 'JSON {"slides":[{"slide_no":1,"title":…,"key_points":[…],"script":…,"seconds":…}]}';
    messages = [{ role: "system", content: DECK_READING_SYSTEM }, { role: "user", content: [
      { type: "text", text: buildDeckReadingUser({ details: { audience: "student", goal: "Diagnosis test", abstract: "A synthetic slide used to test the API.", total_minutes: 1 }, from: 1, to: 1, total: 1 }) },
      { type: "text", text: "Slide 1:" }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}` } },
    ] }];
  } else if (!gem && !custom) {
    request = 'Reply with exactly {"ok":true}';
    expected = '{"ok":true}';
    messages = [{ role: "user", content: 'Reply with exactly {"ok":true}' }];
  } else {
    const prompt = input.prompt?.trim();
    if (!prompt) return fin({ request: "", expected: "", actual: "", model, key: { slot: k.slot, masked: k.masked }, error: { kind: "bad_request", reason: "Type a prompt to send.", hint: "Custom mode sends exactly what you type.", upstream: "" } });
    request = `${image ? "[sample slide image attached]\n" : ""}${prompt}`;
    expected = input.expect ? `contains: ${input.expect}` : "(no expectation set; read the answer yourself)";
    messages = [{ role: "user", content: image ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}` } }] : prompt }];
  }

  const t0 = Date.now();
  let res: Response;
  try {
    res = await deps.fetchFn(gem ? GEMINI_CHAT_URL : NVIDIA_CHAT_URL, {
      method: "POST", headers: { Authorization: `Bearer ${k.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: gem && !custom ? 8192 : 1024, temperature: 0.2, stream: false }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return fin({ request, expected, actual: "", model, key: { slot: k.slot, masked: k.masked }, error: classifyThrown(e, TIMEOUT_MS), ms: Date.now() - t0 });
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  const ms = Date.now() - t0;
  const common = { request, expected, model, key: { slot: k.slot, masked: k.masked }, http_status: res.status, ms };
  if (!res.ok) return fin({ ...common, actual: upstreamMessage(json), error: classifyHttp(res.status, json, provider) });

  let text = "";
  try { text = chatText(json); } catch { return fin({ ...common, actual: redact(JSON.stringify(json ?? "")).slice(0, 600), error: { kind: "invalid_output", reason: `${provider} answered 200 but with no text (safety block, or the output budget was used up).`, hint: "Try again or use a different prompt or model.", upstream: "" } }); }

  // A custom prompt with no expectation has nothing to judge: the verdict stays "unchecked" and the owner reads the answer.
  const checks: Check[] = custom && !input.expect ? [] : [{ name: `${provider} answered (HTTP ${res.status})`, ok: true }];
  let actual = text;
  if (!custom && gem) {
    try {
      const out = deckReadingOut.parse(parseJsonLoose(text));
      const s = out.slides.find((x) => x.slide_no === 1) ?? out.slides[0]!;
      actual = `title: ${s.title || "(none)"}\nkey points (${s.key_points.length}): ${s.key_points.join(" | ")}\nseconds: ${s.seconds ?? "(none)"}\nscript: ${s.script || "(empty)"}`;
      checks.push({ name: "valid JSON in the expected shape", ok: true }, { name: "slide 1 present", ok: out.slides.some((x) => x.slide_no === 1) }, { name: "has key points", ok: s.key_points.length >= 1 }, { name: "has a script", ok: s.script.length > 0 });
    } catch { checks.push({ name: "valid JSON in the expected shape", ok: false, detail: "the answer could not be parsed" }); }
  } else if (!custom) {
    let parsed: unknown = null; try { parsed = parseJsonLoose(text); } catch { /* checked below */ }
    checks.push({ name: 'answers {"ok":true}', ok: (parsed as { ok?: unknown } | null)?.ok === true });
  } else if (input.expect) {
    checks.push({ name: `answer contains "${input.expect.slice(0, 60)}"`, ok: containsCheck(text, input.expect) });
  }
  return fin({ ...common, actual: clip(actual), checks });
}

async function asrCheck(deps: Deps, input: z.infer<typeof bodySchema>, fin: Fin): Promise<DiagnosisResult> {
  const k = pickKey(deps, "speech_to_text", input.slot);
  const model = deps.env.NVIDIA_ASR_MODEL_LABEL;
  const request = "A 6-second synthetic speech clip (text-to-speech) sent to the speech-to-text service";
  if (!k) return fin({ request, expected: SPEECH_TEXT, actual: "", model, error: notConfigured("A speech-to-text key") });
  const pcm = pcmOf(fromB64(SPEECH_WAV_B64));
  const t0 = Date.now();
  try {
    const r = await deps.asr({ pcm, key: k.key, timeoutMs: TIMEOUT_MS });
    const common = { request, expected: SPEECH_TEXT, model, key: { slot: k.slot, masked: k.masked }, http_status: r.status, ms: Date.now() - t0 };
    if (r.status < 200 || r.status >= 300) return fin({ ...common, actual: upstreamMessage(r.body), error: classifyHttp(r.status, r.body, "NVIDIA") });
    const text = String((r.body as { text?: unknown })?.text ?? "");
    const overlap = wordOverlap(text, SPEECH_TEXT);
    return fin({ ...common, actual: text || "(empty transcript)", checks: [{ name: "service answered", ok: true }, { name: "transcript matches the clip (≥ 60% of the words)", ok: overlap >= 0.6, detail: `${Math.round(overlap * 100)}% of the words found` }] });
  } catch (e) {
    const kind = (e as { kind?: string }).kind;
    return fin({ request, expected: SPEECH_TEXT, actual: "", model, key: { slot: k.slot, masked: k.masked }, ms: Date.now() - t0,
      error: kind === "timeout" ? classifyThrown(Object.assign(new Error("timeout"), { name: "TimeoutError" }), TIMEOUT_MS) : { kind: "network", reason: "Could not reach the speech-to-text service.", hint: "Speech-to-text uses gRPC: check the function's network access, or the Next.js bridge (INTERNAL_TRANSCRIBE_URL) if it is configured.", upstream: redact(String((e as { detail?: string }).detail ?? (e as Error)?.message ?? "")).slice(0, 300) } });
  }
}
