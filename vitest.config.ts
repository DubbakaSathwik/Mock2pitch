import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@shared": path.resolve(__dirname, "supabase/functions/_shared"), "@": path.resolve(__dirname) } },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000, hookTimeout: 120_000 },
});
