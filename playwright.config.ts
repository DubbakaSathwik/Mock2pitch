import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const fakeAudio = path.resolve("tests/fixtures/clip-fillers-synthetic.wav");
const chromiumArgs = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${fakeAudio}`, "--autoplay-policy=no-user-gesture-required"];

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/e2e.json" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure", actionTimeout: 20_000, navigationTimeout: 90_000 },
  webServer: {
    command: `npx next dev --webpack -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXT_PUBLIC_DATA_MODE: "mock" },
  },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, launchOptions: { args: chromiumArgs }, permissions: ["microphone"] }, testIgnore: /webkit-smoke|a11y-sweep/ },
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, hasTouch: true, launchOptions: { args: chromiumArgs }, permissions: ["microphone"] }, testIgnore: /webkit-smoke|a11y-sweep|journey-11/ },
    { name: "a11y", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, launchOptions: { args: chromiumArgs }, permissions: ["microphone"] }, testMatch: /a11y-sweep/ },
    { name: "webkit-smoke", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } }, testMatch: /webkit-smoke/ },
  ],
});
