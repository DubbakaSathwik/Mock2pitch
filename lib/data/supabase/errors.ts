// Normalisation of everything the Supabase stack can throw into AppError(code, message, details).
import { AppError, ERROR_CODES } from "../errors";

const KNOWN = new Set<string>(ERROR_CODES);
const CODE_LIKE = /^[A-Za-z][A-Za-z_]{2,40}$/;

type PgLike = { message?: string; code?: string; details?: string | null; hint?: string | null; status?: number } | null | undefined;

/**
 * PostgREST / RPC errors. Our SQL raises `raise exception '<code>'`, so `error.message` IS the code. Permission errors (42501), expired
 * JWTs (PGRST301/303) and transport failures are mapped to the nearest UI code; anything else is "unknown" (never the raw message).
 */
export function fromPostgrest(e: PgLike): AppError {
  if (!e) return new AppError("unknown");
  const msg = (e.message ?? "").trim();
  if (KNOWN.has(msg)) return new AppError(msg);
  if (e.code === "42501") return new AppError("forbidden");
  if (e.code === "PGRST301" || e.code === "PGRST303" || /jwt/i.test(msg)) return new AppError("not_authenticated");
  if (e.code === "PGRST116") return new AppError("not_found"); // .single() matched no row (also: RLS hid it)
  if (e.status === 0 || /failed to fetch|networkerror|load failed|fetch failed/i.test(msg)) return new AppError("network_error");
  if (CODE_LIKE.test(msg)) return new AppError("unknown", undefined, { backend_code: msg }); // an unmapped code we do not know: keep it for logs only
  return new AppError("unknown");
}

/** Edge Function envelope `{ ok:false, error:{ code, message, ...extra } }` or a gateway error (`{ code, message }` / `{ msg }`). */
export function fromFunctionResponse(status: number, body: unknown): AppError {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const err = (b.error && typeof b.error === "object" ? b.error : null) as Record<string, unknown> | null;
  if (err && typeof err.code === "string") {
    const { code, message, ...extra } = err as { code: string; message?: unknown } & Record<string, unknown>;
    return new AppError(code, typeof message === "string" ? message : undefined, extra);
  }
  if (status === 401) return new AppError("not_authenticated"); // the gateway rejected the JWT (verify_jwt) before our code ran
  if (status === 403) return new AppError("forbidden");
  if (status === 404) return new AppError("not_found");
  if (status === 413) return new AppError("too_large");
  if (status === 429) return new AppError("AI_BUSY");
  return new AppError("unknown", undefined, { status });
}

/** supabase-js auth errors. */
export function fromAuth(e: { message?: string; status?: number; code?: string } | null | undefined): AppError {
  if (!e) return new AppError("unknown");
  if (e.status === 0 || /failed to fetch|network/i.test(e.message ?? "")) return new AppError("network_error");
  return new AppError("not_authenticated");
}
