import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants.js";

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Everything named NEXT_PUBLIC_* is inlined into the JavaScript every visitor downloads. Fail the production build if a server-side secret
 * was put in one by mistake: a variable whose NAME says secret, or a Supabase key whose VALUE is the service-role / secret key.
 * (The anon / publishable key is public by design; it is safe only because every table has RLS.)
 */
function assertNoSecretInPublicVars(env) {
  const bad = [];
  for (const name of Object.keys(env)) {
    if (name.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|TOKEN/i.test(name)) bad.push(`${name} (name looks like a secret)`);
  }
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (key) {
    let role;
    const parts = key.split(".");
    if (parts.length === 3) {
      try { role = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role; } catch { /* not a JWT: nothing to inspect */ }
    }
    if (/^sb_secret_/.test(key) || role === "service_role") bad.push("NEXT_PUBLIC_SUPABASE_ANON_KEY (value is a Supabase secret / service_role key)");
  }
  if (bad.length) throw new Error(`Refusing to build: server-side secrets must never use the NEXT_PUBLIC_ prefix: ${bad.join("; ")}. Use the anon / publishable key here and keep the service-role key out of the web app.`);
}

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
  const isProdBuild = phase === PHASE_PRODUCTION_BUILD;
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  if (isProdBuild) assertNoSecretInPublicVars(process.env);
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
        // Content-Security-Policy is set per request (with a script nonce) by proxy.ts / lib/csp.ts, not here.
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
