// Integration E2E against the REAL stack (hosted Supabase + R2 + NVIDIA). Not part of the normal test run.
//   local app:     npm run test:integration            (starts `next dev` on :3000 using .env.local = supabase mode)
//   deployed site: INTEGRATION_BASE_URL=https://<site>.netlify.app npm run test:integration
// Needs IT_USER_*_EMAIL / IT_USER_*_PASSWORD (scripts/integration/provision-test-users.mjs writes .env.integration.local) and the public
// NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. AI credits are capped: see e2e-int/README.md.
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

for (const f of [".env.local", ".env.integration.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.trim();
  }
}
const base = process.env.INTEGRATION_BASE_URL ?? "http://localhost:3000";
const fakeAudio = path.resolve("tests/fixtures/clip-fillers-synthetic.wav");
const chromiumArgs = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${fakeAudio}`, "--autoplay-policy=no-user-gesture-required"];

export default defineConfig({
  testDir: "e2e-int",
  timeout: 300_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/integration.json" }]],
  use: { baseURL: base, trace: "retain-on-failure", screenshot: "only-on-failure", actionTimeout: 30_000, navigationTimeout: 90_000 },
  webServer: process.env.INTEGRATION_BASE_URL ? undefined : { command: "npx next dev --webpack -p 3000", url: base, reuseExistingServer: true, timeout: 180_000 },
  projects: [
    { name: "integration-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, launchOptions: { args: chromiumArgs }, permissions: ["microphone"] } },
    { name: "integration-mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, hasTouch: true, launchOptions: { args: chromiumArgs }, permissions: ["microphone"] } },
  ],
});
