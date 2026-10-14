import path from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {(phase: string) => import('next').NextConfig} */
export default function config(phase) {
  const isProdBuild = phase === PHASE_PRODUCTION_BUILD;
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
    webpack: (cfg) => {
      cfg.resolve.alias["@shared"] = path.join(root, "supabase/functions/_shared");
      // _shared modules import siblings with explicit .ts extensions (needed by Deno).
      cfg.resolve.extensionAlias = { ".ts": [".ts", ".js"] };
      return cfg;
    },
  };
}
