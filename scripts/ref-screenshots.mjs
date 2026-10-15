// Captures the design prototype (docs/design-handoff) at 1280x800 and 390x844 via its prototype-only "Screens" menu.
// Usage: node scripts/ref-screenshots.mjs   (serves the prototype on :4173 itself)
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = "docs/design-handoff/design_handoff_mock2pitch/prototype";
const out = "docs/phase-2/reference";
const screens = [
  "S1 Landing", "S2 Sign in", "S3 Terms (first time)", "S3 Terms (updated)", "S4 Profile setup",
  "S5 Dashboard (empty)", "S5 Dashboard (with history)", "S6 Upload", "S6 Upload (error)", "S7 Extracting", "S8 Slide prep", "S9 Set time", "S10 Mic check", "S10 Mic denied",
  "S11 Before recording", "S11 Recording", "S11 Recorded", "S11 Overrun (red)", "S11 Leave confirm", "S12 Review (all recorded)", "S12 Review (some missing)", "S13 Analysing",
  "S14 Report: attempt 1", "S14 Report: retake (74)", "S15 History (empty)", "S15 History", "S16 Deck detail", "S17 Settings", "S18 Limit reached",
  "A0 Owner sign in", "A1 Dashboard", "A2 Students", "A3 Student detail", "A4 Ratings", "A5 AI usage", "A6 Terms and Privacy",
];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const server = spawn("python3", ["-m", "http.server", "4173", "--directory", root], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1000));
const browser = await chromium.launch();
try {
  for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 390, height: 844 }]]) {
    fs.mkdirSync(path.join(out, name), { recursive: true });
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    let i = 0;
    for (const label of screens) {
      i++;
      await page.goto("http://localhost:4173/index.html");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForSelector("text=Screens");
      await page.getByRole("button", { name: "Screens" }).click();
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.waitForTimeout(label.startsWith("S7") ? 5200 : 700);
      await page.screenshot({ path: path.join(out, name, `${String(i).padStart(2, "0")}-${slug(label)}.png`) });
      if (label === "S10 Mic check") {
        await page.getByRole("button", { name: "Allow microphone" }).click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(out, name, `${String(i).padStart(2, "0")}b-s10-mic-granted.png`) });
      }
    }
    await ctx.close();
  }
} finally { await browser.close(); server.kill(); }
console.log("done");
