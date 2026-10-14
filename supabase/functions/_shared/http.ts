// Response/CORS/error helpers shared by all Edge Functions.
export class AppError extends Error {
  constructor(public code: string, public status: number, message?: string, public extra?: Record<string, unknown>) {
    super(message ?? code);
  }
}
export const Errors = {
  unauthenticated: () => new AppError("not_authenticated", 401, "Please sign in."),
  forbidden: (code = "forbidden") => new AppError(code, 403, "You can't do that."),
  notFound: () => new AppError("not_found", 404, "Not found."),
  badRequest: (code = "invalid_request", message = "Invalid request.", extra?: Record<string, unknown>) => new AppError(code, 400, message, extra),
  conflict: (code = "conflict", message = "That isn't possible right now.") => new AppError(code, 409, message),
  tooLarge: (code = "too_large") => new AppError(code, 413, "That file is too large."),
  limit: (code = "daily_limit_reached") => new AppError(code, 429, "Daily limit reached."),
  aiBusy: () => new AppError("AI_BUSY", 429, "Our AI is busy, try again in a minute."),
  internal: () => new AppError("internal", 500, "Something went wrong."),
};

// Postgres error codes raised by our SQL functions use `raise exception using message='<code>'`.
const PRACTICE_CODES: Record<string, number> = {
  not_authenticated: 401, is_admin: 403, blocked: 403, profile_incomplete: 403, policy_not_accepted: 403,
  daily_limit_reached: 429, forbidden: 403, not_found: 404, invalid_state: 409, invalid_minutes: 400,
};
export function fromDbError(e: { message?: string } | null | undefined): AppError {
  const code = (e?.message ?? "").trim();
  const status = PRACTICE_CODES[code];
  return status ? new AppError(code, status) : Errors.internal();
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && allowed.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Max-Age"] = "3600";
  }
  return h;
}

export function json(body: unknown, status: number, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
}
export const ok = (data: unknown, cors: Record<string, string> = {}, status = 200) => json({ ok: true, data }, status, cors);
export function fail(e: unknown, cors: Record<string, string> = {}): Response {
  const err = e instanceof AppError ? e : Errors.internal();
  if (!(e instanceof AppError)) console.error(JSON.stringify({ level: "error", msg: "unhandled", name: (e as Error)?.name })); // never log message (may carry content)
  return json({ ok: false, error: { code: err.code, message: err.message, ...(err.extra ?? {}) } }, err.status, cors);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
