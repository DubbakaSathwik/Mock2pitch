/**
 * Content-Security-Policy, built per request by proxy.ts.
 *
 * Scripts are locked to this origin plus a per-request NONCE ('strict-dynamic'): an injected <script> or inline event handler cannot run,
 * because an attacker cannot guess the nonce. Next.js attaches the nonce to its own bootstrap scripts automatically (the page must render
 * dynamically: see `connection()` in app/layout.tsx).
 *
 * style-src keeps 'unsafe-inline' on purpose: React renders inline `style=""` attributes in ~50 components and a nonce cannot cover
 * attributes. Styles cannot execute script, so this is the narrow, accepted residue.
 *
 * Everything else is locked to this origin plus the services the app really talks to: Supabase (https + wss), Cloudflare R2 signed URLs
 * (uploads/downloads), Google avatars. pdf.js needs a blob/self worker and WebAssembly; recorded audio and rendered slide images are blob: URLs.
 * Dev adds 'unsafe-eval' (webpack source maps / React debug info) and the HMR socket.
 */
export function buildCsp({ nonce, isDev, supabaseUrl }: { nonce: string; isDev: boolean; supabaseUrl?: string }): string {
  const supabaseHttp = supabaseUrl ? [new URL(supabaseUrl).origin] : [];
  const supabaseWs = supabaseUrl ? [`wss://${new URL(supabaseUrl).host}`] : [];
  const r2 = ["https://*.r2.cloudflarestorage.com"];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'wasm-unsafe-eval'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com", ...r2],
    "media-src": ["'self'", "blob:", ...r2],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabaseHttp, ...supabaseWs, ...r2, ...(isDev ? ["ws://localhost:*", "ws://127.0.0.1:*"] : [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}

/** 128 bits of randomness, base64: unique per request. */
export function newNonce(): string {
  return btoa(crypto.randomUUID());
}
