// Phase 0 / §3 live spike: verifies the NVIDIA models, measures latency, vision input limits, JSON reliability and ASR.
// NEEDS NETWORK ACCESS TO NVIDIA AND KEYS. Usage:
//   NVIDIA_SLIDE_KEY_PRIMARY=... NVIDIA_REPORT_KEY_PRIMARY=... NVIDIA_ASR_KEY_PRIMARY=... NVIDIA_ASR_FUNCTION_ID=... \
//   [NVIDIA_SLIDE_MODEL=...] [NVIDIA_REPORT_MODEL=...] npx tsx scripts/spike-nvidia.mjs
// Prints a Markdown report to paste into docs/phase-1/spikes.md. Never prints keys.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const BASE = "https://integrate.api.nvidia.com/v1";
const slideModel = env.NVIDIA_SLIDE_MODEL ?? "meta/llama-4-maverick-17b-128e-instruct";
const reportModel = env.NVIDIA_REPORT_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b";
const SLIDE_CANDIDATES = [slideModel, "nvidia/nemotron-nano-12b-v2-vl", "meta/llama-3.2-90b-vision-instruct"];
const REPORT_CANDIDATES = [reportModel, "nvidia/nemotron-3.5-lightning-30b-a3b", "meta/llama-3.3-70b-instruct"];

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const out = [];
const log = (s = "") => { out.push(s); console.log(s); };

async function chat(key, model, messages, extra = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_tokens: 1500, temperature: 0.2, stream: false, ...extra }),
  });
  const ms = Date.now() - t0;
  let body = null; try { body = await res.json(); } catch { /* non-json */ }
  return { status: res.status, ms, body, retryAfter: res.headers.get("retry-after") };
}

async function listModels(key) {
  const res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) return { error: res.status, ids: new Set() };
  const j = await res.json();
  return { ids: new Set((j.data ?? []).map((m) => m.id)) };
}

log("# NVIDIA live spike results\n");
log(`Run at ${new Date().toISOString()}\n`);

// ---- slide reading ----
const sk = env.NVIDIA_SLIDE_KEY_PRIMARY;
if (!sk) log("## slide_reading\nBLOCKED: NVIDIA_SLIDE_KEY_PRIMARY not set.\n");
else {
  const models = await listModels(sk);
  log("## slide_reading");
  for (const m of SLIDE_CANDIDATES) log(`- ${m}: ${models.ids.has(m) ? "listed" : "NOT in /v1/models"}`);
  const img = fs.readFileSync(path.join(root, "tests/fixtures/slide-1.jpg"));
  const sys = fs.readFileSync(path.join(root, "supabase/functions/_shared/prompts/slide-reading.ts"), "utf8").match(/`([\s\S]*?)`/)[1];
  for (const m of SLIDE_CANDIDATES.filter((m) => models.ids.has(m))) {
    const lat = []; let valid = 0, last = null;
    for (let i = 0; i < 5; i++) {
      const r = await chat(sk, m, [{ role: "system", content: sys }, { role: "user", content: [{ type: "text", text: "Read this slide and return the JSON object described." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${img.toString("base64")}` } }] }]);
      last = r; lat.push(r.ms);
      try { JSON.parse(r.body.choices[0].message.content.replace(/^```json|```$/g, "")); valid++; } catch { /* invalid */ }
    }
    log(`- **${m}**: p50 ${pct(lat, 50)} ms, p95 ${pct(lat, 95)} ms, valid JSON ${valid}/5, last status ${last.status}, usage ${JSON.stringify(last.body?.usage ?? null)}`);
  }
  // inline payload limit probe: grow a JPEG-like payload until the API refuses it
  log("- inline image size probe (base64 data URL):");
  for (const kb of [200, 500, 1000, 2000, 4000]) {
    const pad = Buffer.concat([img, Buffer.alloc(kb * 1024)]);
    const r = await chat(sk, slideModel, [{ role: "user", content: [{ type: "text", text: "Reply with the word ok." }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${pad.toString("base64")}` } }] }], { max_tokens: 5 });
    log(`  - ${kb} KB: HTTP ${r.status}`);
  }
}

// ---- report generation ----
const rk = env.NVIDIA_REPORT_KEY_PRIMARY;
if (!rk) log("\n## report_generation\nBLOCKED: NVIDIA_REPORT_KEY_PRIMARY not set.\n");
else {
  const models = await listModels(rk);
  log("\n## report_generation");
  const sys = fs.readFileSync(path.join(root, "supabase/functions/_shared/prompts/report.ts"), "utf8").match(/`([\s\S]*?)`/)[1];
  const slides = Array.from({ length: 8 }, (_, i) => ({ slide_index: i, title: `Slide ${i + 1}`, key_points: ["Point A", "Point B", "Point C"], suggested_seconds: 40, actual_seconds: 38, wpm: 140, filler_counts: [{ word: "um", count: 2 }], recorded: true, transcript: "So um today we talk about the parking system and how the sensors work, basically they detect free bays." }));
  for (const m of REPORT_CANDIDATES.filter((m) => models.ids.has(m))) {
    const lat = []; let valid = 0, jsonMode = null;
    for (let i = 0; i < 5; i++) {
      const r = await chat(rk, m, [{ role: "system", content: sys }, { role: "user", content: JSON.stringify({ slides }) }]);
      lat.push(r.ms);
      try { const j = JSON.parse(r.body.choices[0].message.content.replace(/^```json|```$/g, "")); if (j.top_fixes?.length === 3 && j.did_well?.length === 3) valid++; } catch { /* invalid */ }
    }
    const jm = await chat(rk, m, [{ role: "system", content: sys }, { role: "user", content: JSON.stringify({ slides }) }], { response_format: { type: "json_object" } });
    jsonMode = jm.status;
    log(`- **${m}**: p50 ${pct(lat, 50)} ms, p95 ${pct(lat, 95)} ms, schema-valid ${valid}/5, JSON mode (response_format) HTTP ${jsonMode}`);
  }
  for (const m of REPORT_CANDIDATES) if (!models.ids.has(m)) log(`- ${m}: NOT in /v1/models`);
}

// ---- speech to text ----
const ak = env.NVIDIA_ASR_KEY_PRIMARY;
if (!ak || !env.NVIDIA_ASR_FUNCTION_ID) log("\n## speech_to_text\nBLOCKED: NVIDIA_ASR_KEY_PRIMARY / NVIDIA_ASR_FUNCTION_ID not set.\n");
else {
  log("\n## speech_to_text (Riva gRPC)");
  const { recognizePcm } = await import("../supabase/functions/_shared/riva/client.ts").catch(async () => {
    // Node cannot import .ts directly on older versions; use tsx if available.
    throw new Error("Run with: npx tsx scripts/spike-nvidia.mjs  (needs the TypeScript Riva client)");
  });
  const wav = fs.readFileSync(path.join(root, process.env.SPIKE_WAV ?? "tests/fixtures/clip-fillers-synthetic.wav"));
  const pcm = new Uint8Array(wav.subarray(44));
  const lat = [];
  let transcript = "";
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const t = await recognizePcm(pcm, { functionId: env.NVIDIA_ASR_FUNCTION_ID, apiKey: ak, timeoutMs: 60000 });
    lat.push(Date.now() - t0); transcript = t.text;
  }
  const fillers = ["um", "uh", "like", "basically", "you know", "actually"].map((f) => `${f}: ${(transcript.toLowerCase().match(new RegExp(`\\b${f}\\b`, "g")) ?? []).length}`);
  log(`- ${env.NVIDIA_ASR_MODEL_LABEL ?? "asr"}: p50 ${pct(lat, 50)} ms, p95 ${pct(lat, 95)} ms for ${Math.round(pcm.length / 32000)} s of audio`);
  log(`- transcript: "${transcript}"`);
  log(`- fillers retained: ${fillers.join(", ")}`);
  log("- NOTE: if SPIKE_WAV is the synthetic TTS fixture this measures plumbing only; use a human recording to judge filler retention.");
}
fs.writeFileSync(path.join(root, "docs/phase-1/spike-results.generated.md"), out.join("\n") + "\n");
