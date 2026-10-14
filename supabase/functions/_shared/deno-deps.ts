// Production wiring for Deno (Supabase Edge Runtime). Not imported by tests.
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env.ts";
import { R2 } from "./r2.ts";
import { json } from "./http.ts";
import type { Deps } from "./deps.ts";
import { routeAsr } from "./ai/asr-route.ts";
import type { AsrCall } from "./deps.ts";

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: any;

export function buildDeps(): Deps {
  const env = getEnv();
  const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth });
  const r2 = new R2({ accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET });
  // Option B (Next.js internal route) when configured; otherwise Option A (in-process gRPC).
  const asr: AsrCall = env.INTERNAL_TRANSCRIBE_URL && env.INTERNAL_TRANSCRIBE_SECRET
    ? routeAsr({ url: env.INTERNAL_TRANSCRIBE_URL, secret: env.INTERNAL_TRANSCRIBE_SECRET, functionId: env.NVIDIA_ASR_FUNCTION_ID })
    : async (req) => {
      const { grpcAsr } = await import("./ai/asr-grpc.ts"); // loaded only when speech-to-text actually runs
      return grpcAsr({ functionId: env.NVIDIA_ASR_FUNCTION_ID })(req);
    };
  return {
    env, admin, r2, asr, fetchFn: fetch, now: () => new Date(),
    userClient: (jwt: string) => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth, global: { headers: { Authorization: `Bearer ${jwt}` } } }),
    background: (p) => {
      const guarded = p.catch((e) => console.error(JSON.stringify({ level: "error", msg: "background_failed", name: (e as Error)?.name })));
      try { EdgeRuntime.waitUntil(guarded); } catch { /* not running on the Edge Runtime (local deno) */ }
    },
    asrProbe: async (key, timeoutMs) => {
      const { getRivaConfig } = await import("./riva/client.ts"); // loaded only when the self-test asks
      return getRivaConfig({ functionId: env.NVIDIA_ASR_FUNCTION_ID, apiKey: key, timeoutMs });
    },
    invoke: async (fn, body) => {
      await fetch(`${env.SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "x-internal-secret": env.INTERNAL_FUNCTION_SECRET },
        body: JSON.stringify(body),
      });
    },
  };
}

export function serve(handler: (req: Request, deps: Deps) => Promise<Response>) {
  let deps: Deps | null = null;
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(async (req: Request) => {
    try { deps ??= buildDeps(); } catch (e) {
      console.error(JSON.stringify({ level: "error", msg: "misconfigured", detail: (e as Error).message })); // names variables, never values
      return json({ ok: false, error: { code: "misconfigured", message: "The server isn't configured." } }, 500);
    }
    return handler(req, deps);
  });
}
