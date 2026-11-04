// Pure helpers for the admin Diagnosis page: turn an upstream failure into a plain-words reason, keep secrets out of what is shown, and
// compare an actual answer with what was expected.

export type FailureKind = "bad_key" | "not_found" | "quota" | "overloaded" | "timeout" | "network" | "bad_request" | "invalid_output" | "not_configured" | "other";
export type Failure = { kind: FailureKind; reason: string; hint: string; upstream?: string };

/** Never show anything that looks like a key, bearer token or long secret, even in an upstream error message. */
export function redact(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-google-key]")
    .replace(/nvapi-[0-9A-Za-z_-]{10,}/g, "[redacted-nvidia-key]")
    .replace(/Bearer\s+[0-9A-Za-z._~+/=-]{12,}/gi, "Bearer [redacted]")
    .replace(/\b[0-9A-Za-z_-]{40,}\b/g, "[redacted]");
}

/** The upstream error message from an OpenAI-style or Google-style JSON body (object or array), else a short head of the text. */
export function upstreamMessage(body: unknown): string {
  const first = Array.isArray(body) ? body[0] : body;
  const err = (first as { error?: unknown } | null)?.error;
  const msg = typeof err === "string" ? err : (err as { message?: unknown } | undefined)?.message;
  if (typeof msg === "string" && msg) return redact(msg).slice(0, 400);
  if (typeof first === "string") return redact(first).slice(0, 400);
  try { return redact(JSON.stringify(first ?? "")).slice(0, 400); } catch { return ""; }
}

/** An HTTP answer that is not 2xx -> what it means and what to do about it. */
export function classifyHttp(status: number, body: unknown, provider: "Gemini" | "NVIDIA"): Failure {
  const upstream = upstreamMessage(body);
  const text = upstream.toLowerCase();
  if (status === 400 && /api key|api_key_invalid|invalid api key|key expired/.test(text)) {
    return { kind: "bad_key", reason: `${provider} rejected the API key (it is invalid or expired).`, hint: `Create a new key and update the secret, or switch to another key slot.`, upstream };
  }
  if (status === 401 || status === 403) {
    return { kind: "bad_key", reason: `${provider} refused the key (HTTP ${status}): wrong key, no permission for this model, or the key was disabled.`, hint: "Check the key in the provider's console and that billing / API access is enabled for this project.", upstream };
  }
  if (status === 404 || status === 410) {
    return { kind: "not_found", reason: `${provider} does not know this model (HTTP ${status}). It was retired, renamed, or is not available to this key.`, hint: "Pick a model that is listed for this key and update the model secret. A *-latest alias avoids retirements.", upstream };
  }
  if (status === 429) {
    return { kind: "quota", reason: `${provider} is rate limiting this key or its quota is used up (HTTP 429).`, hint: "Wait a minute and retry, add a second key from another project, or raise the quota / enable billing.", upstream };
  }
  if (status >= 500) {
    return { kind: "overloaded", reason: `${provider} had a problem on its side (HTTP ${status}); usually the model is overloaded.`, hint: "Retry in a moment, or use a lighter model (for Gemini: gemini-flash-lite-latest) or the fallback model.", upstream };
  }
  if (status === 400 || status === 422) {
    return { kind: "bad_request", reason: `${provider} could not process this request (HTTP ${status}).`, hint: "Check the model name and the input. Read the message below.", upstream };
  }
  return { kind: "other", reason: `Unexpected answer from ${provider} (HTTP ${status}).`, hint: "Read the message below.", upstream };
}

/** A fetch that threw: timeout or network. */
export function classifyThrown(e: unknown, timeoutMs: number): Failure {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "TimeoutError" || name === "AbortError") return { kind: "timeout", reason: `No answer within ${Math.round(timeoutMs / 1000)} seconds.`, hint: "The model is overloaded or too slow. Retry, or use a lighter model.", upstream: "" };
  return { kind: "network", reason: "Could not reach the service (network error).", hint: "Check the network allow-list of the Edge Function and the provider's status page.", upstream: redact(String((e as Error)?.message ?? "").slice(0, 200)) };
}

export const notConfigured = (what: string): Failure => ({ kind: "not_configured", reason: `${what} is not configured.`, hint: "Set the key / setting in Supabase → Edge Functions → Secrets.", upstream: "" });

/** Case-insensitive "contains" with whitespace collapsed: the optional expectation typed on the page. */
export function containsCheck(actual: string, expected: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return norm(actual).includes(norm(expected));
}

/** Share of the expected words that appear in the actual text (0..1), ignoring case and punctuation: used for speech-to-text. */
export function wordOverlap(actual: string, expected: string): number {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const exp = words(expected);
  if (exp.length === 0) return 1;
  const act = new Set(words(actual));
  return exp.filter((w) => act.has(w)).length / exp.length;
}
