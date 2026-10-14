import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Phase 1 ships no product UI; this shell exists for env validation, shared types and the internal transcribe route.
  experimental: { externalDir: true },
  outputFileTracingRoot: root,
  serverExternalPackages: ["@grpc/grpc-js", "@grpc/proto-loader"],
  webpack: (config) => {
    config.resolve.alias["@shared"] = path.join(root, "supabase/functions/_shared");
    // _shared modules import siblings with explicit .ts extensions (needed by Deno).
    config.resolve.extensionAlias = { ".ts": [".ts", ".js"] };
    return config;
  },
};
export default nextConfig;
