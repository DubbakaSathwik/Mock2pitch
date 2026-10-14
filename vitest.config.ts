import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@shared": path.resolve(__dirname, "supabase/functions/_shared"), "@": path.resolve(__dirname) } },
  test: { css: { modules: { classNameStrategy: "non-scoped" } }, include: ["tests/**/*.test.{ts,tsx}"], testTimeout: 60_000, hookTimeout: 120_000, setupFiles: ["tests/frontend/setup.ts"] },
});
