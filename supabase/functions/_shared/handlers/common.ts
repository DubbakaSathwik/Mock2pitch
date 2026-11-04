import { z } from "zod";
import { AppError, corsHeaders, Errors, fail, fromDbError, json, ok, timingSafeEqual } from "../http.ts";
import { allowedOrigins } from "../env.ts";
import type { Ctx, Deps } from "../deps.ts";

export type Authed = { userId: string; jwt: string; userClient: ReturnType<Deps["userClient"]> };

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1]!.trim() : null;
}

/** Verifies the caller's JWT with the Auth server (never just decodes it). */
export async function requireUser(ctx: Ctx): Promise<Authed> {
  const jwt = bearer(ctx.req);
  if (!jwt) throw Errors.unauthenticated();
  const userClient = ctx.deps.userClient(jwt);
  const { data, error } = await userClient.auth.getUser(jwt);
  if (error || !data?.user?.id) throw Errors.unauthenticated();
  return { userId: data.user.id as string, jwt, userClient };
}

export function isInternal(req: Request, deps: Deps): boolean {
  const s = req.headers.get("x-internal-secret");
  return !!s && timingSafeEqual(s, deps.env.INTERNAL_FUNCTION_SECRET);
}

/** Every real request body is tiny (ids, a few short strings, at most 10 clip sizes). Anything bigger is abuse, not a feature. */
export const MAX_BODY_BYTES = 64 * 1024;

/** Reads the body as text, aborting as soon as it exceeds MAX_BODY_BYTES so an oversized payload is never buffered or parsed. */
async function readCappedText(req: Request): Promise<string> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw Errors.tooLarge("body_too_large");
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) { await reader.cancel().catch(() => {}); throw Errors.tooLarge("body_too_large"); } // content-length can lie or be absent (chunked)
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(all);
}

export async function readBody<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  const text = await readCappedText(req); // 413 body_too_large propagates; only malformed JSON / shape is a 400
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw Errors.badRequest(); }
  const r = schema.safeParse(raw);
  if (!r.success) throw Errors.badRequest();
  return r.data;
}

/** Common wrapper: CORS (allow-list only), POST-only, uniform error envelope. */
export function api(fn: (ctx: Ctx) => Promise<Response>) {
  return async (req: Request, deps: Deps): Promise<Response> => {
    const cors = corsHeaders(req.headers.get("origin"), allowedOrigins(deps.env));
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      if (req.method !== "POST") throw new AppError("method_not_allowed", 405, "Method not allowed.");
      const res = await fn({ req, deps, cors });
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      return fail(e, cors);
    }
  };
}

/** Runs a user-JWT RPC and maps SQL error codes to HTTP errors. */
export async function checkCanPractise(a: Authed, limit: boolean, policy: boolean) {
  const { error } = await a.userClient.rpc("check_can_practise", { p_check_limit: limit, p_require_policy: policy });
  if (error) throw fromDbError(error);
}

export { ok, json, Errors, fail, fromDbError, AppError };

/** Student-only guard for read paths (admins are denied, blocked students may read). */
export async function requireNotAdmin(ctx: Ctx, userId: string) {
  const { data } = await ctx.deps.admin.from("profiles").select("role, is_blocked").eq("id", userId).maybeSingle();
  if (!data) throw Errors.unauthenticated();
  if (data.role === "admin") throw new AppError("is_admin", 403, "Admin accounts can't practise.");
  return data as { role: string; is_blocked: boolean };
}

export function logEvent(msg: string, fields: Record<string, string | number | boolean | null> = {}) {
  console.log(JSON.stringify({ level: "info", msg, ...fields })); // counts/ids only; never content, keys or URLs
}
