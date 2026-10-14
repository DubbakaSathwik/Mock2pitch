/** Only same-origin app paths are accepted as a post-sign-in destination (no open redirects). */
export function safeNext(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.startsWith("/sign-in") || raw.startsWith("/admin/sign-in") || raw.startsWith("/auth/")) return fallback;
  return raw;
}
