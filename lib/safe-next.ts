/** Only same-origin app paths are accepted as a post-sign-in destination (no open redirects). */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  // The WHATWG URL parser silently drops tab / CR / LF anywhere in its input, so "/\t/evil.com" would become "//evil.com" (a cross-origin
  // redirect) after this check had passed. Reject every control character and any backslash outright.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Belt and braces: resolve it exactly as the redirect will and require that it stays on the same origin.
  const base = "http://same-origin.invalid";
  let resolved: URL;
  try { resolved = new URL(raw, base); } catch { return fallback; }
  if (resolved.origin !== base) return fallback;
  if (raw.startsWith("/sign-in") || raw.startsWith("/admin/sign-in") || raw.startsWith("/auth/")) return fallback;
  return raw;
}
