import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Content-Security-Policy. Next.js injects inline bootstrap scripts and React renders inline style attributes, so `script-src` and
 * `style-src` keep 'unsafe-inline' (no nonce pipeline); everything else is locked to this origin plus the services the app really
 * talks to: Supabase (https + wss), Cloudflare R2 signed URLs (uploads/downloads), Google avatars. pdf.js needs a blob/self worker and
 * WebAssembly; recorded audio and rendered slide images are blob: URLs. Dev adds 'unsafe-eval' (webpack source maps) and the HMR socket.
 */
function contentSecurityPolicy(isDev) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHttp = supabase ? [new URL(supabase).origin] : [];
  const supabaseWs = supabase ? [`wss://${new URL(supabase).host}`] : [];
  const r2 = ["https://*.r2.cloudflarestorage.com"];
  const directives = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", ...(isDev ? ["'unsafe-eval'"] : [])],
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

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
  const isProdBuild = phase === PHASE_PRODUCTION_BUILD;
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  const mode = process.env.NEXT_PUBLIC_DATA_MODE || "mock";
  // Fail fast: a production build must not ship the mock backend unless explicitly allowed (review deploy only).
  if (isProdBuild && mode === "mock" && process.env.NEXT_PUBLIC_ALLOW_MOCK_IN_PROD !== "1") {
    throw new Error("NEXT_PUBLIC_DATA_MODE=mock is not allowed in a production build. Set NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1 for a review deploy, or use NEXT_PUBLIC_DATA_MODE=supabase (Phase 3).");
  }
  return {
    reactStrictMode: true,
    poweredByHeader: false,
    // `*.dev.tsx` pages (e.g. /dev/design-system) only exist outside production builds.
    pageExtensions: isProdBuild ? ["tsx", "ts"] : ["tsx", "ts", "dev.tsx"],
    experimental: { externalDir: true },
    outputFileTracingRoot: root,
    serverExternalPackages: ["@grpc/grpc-js", "@grpc/proto-loader"],
    async headers() {
      const security = [
        { key: "Content-Security-Policy", value: contentSecurityPolicy(isDevServer) },
        { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=()" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        ...(!isDevServer ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
      ];
      return [{ source: "/:path*", headers: security }];
    },
    webpack: (cfg) => {
      cfg.resolve.alias["@shared"] = path.join(root, "supabase/functions/_shared");
      // _shared modules import siblings with explicit .ts extensions (needed by Deno).
      cfg.resolve.extensionAlias = { ".ts": [".ts", ".js"] };
      return cfg;
    },
  };
}
