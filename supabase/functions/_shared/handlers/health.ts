// Public liveness + configuration probe (GET or POST, no auth). Safe to hit from an uptime monitor: it makes NO paid AI calls and returns
// only booleans/counts/timings: never keys, key names, URLs, model ids or user data. For the deep checks (real Gemini/NVIDIA calls, the
// full pipeline) use the internal-only `ops-selftest` function.
import { corsHeaders, fail, json } from "../http.ts";
import { allowedOrigins, keysFor } from "../env.ts";
import type { Deps } from "../deps.ts";
import { PURPOSES } from "../constants.ts";

type Check = { ok: boolean; ms: number; detail?: Record<string, unknown> };

async function timed(fn: () => Promise<{ ok: boolean; detail?: Record<string, unknown> }>): Promise<Check> {
  const t0 = Date.now();
  try { const r = await fn(); return { ok: r.ok, ms: Date.now() - t0, ...(r.detail ? { detail: r.detail } : {}) }; }
  catch { return { ok: false, ms: Date.now() - t0 }; } // never echo upstream error text
}

export async function health(req: Request, deps: Deps): Promise<Response> {
  const cors = corsHeaders(req.headers.get("origin"), allowedOrigins(deps.env));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  try {
    if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: { code: "method_not_allowed", message: "Method not allowed." } }, 405, cors);
    const database = await timed(async () => {
      const { data, error } = await deps.admin.from("ai_key_slots").select("id");
      if (error) return { ok: false };
      return { ok: (data ?? []).length === 9, detail: { key_slots: (data ?? []).length } };
    });
    const storage = await timed(async () => { await deps.r2.head("healthcheck/ping"); return { ok: true }; }); // 404 -> null; bad credentials throw
    const ai: Record<string, { keys_configured: number; primary_configured: boolean }> = {};
    for (const p of PURPOSES) { const k = keysFor(deps.env, p); ai[p] = { keys_configured: k.length, primary_configured: k.some((x) => x.slot === "primary") }; }
    const aiOk = PURPOSES.every((p) => ai[p]!.primary_configured);
    const allOk = database.ok && storage.ok && aiOk;
    const data = {
      time: deps.now().toISOString(),
      checks: { database, storage, ai: { ok: aiOk, purposes: ai, slide_reader: "gemini", fallback_model_configured: !!deps.env.GEMINI_SLIDE_FALLBACK_MODEL } },
    };
    return json({ ok: allOk, data }, allOk ? 200 : 503, { ...cors, "Cache-Control": "no-store" });
  } catch (e) {
    return fail(e, cors);
  }
}
