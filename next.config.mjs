/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 1 ships no product UI; this shell exists for env validation, shared types and the optional internal transcribe route.
  experimental: { externalDir: true },
};
export default nextConfig;
