// Captures every screen/state of the NEW app at 1280×800 and 390×844 into docs/phase-2/screens/{desktop,mobile}/ using the same
// file names as docs/phase-2/reference/ (prototype) so docs/phase-2/fidelity.md can pair them.
// Usage: (dev server on :3100)  node scripts/capture-screens.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/phase-2/screens";
const fakeAudio = path.resolve("tests/fixtures/clip-fillers-synthetic.wav");
const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-audio-capture=${fakeAudio}`] });

async function session(persona, vp, { stageMs = 150, deny = false } = {}) {
  const ctx = await browser.newContext({ viewport: vp, permissions: ["microphone"], hasTouch: vp.width < 760, deviceScaleFactor: 1 });
  await ctx.addInitScript(([p, c, d]) => {
    try { if (!sessionStorage.getItem("m2p.mock.state.v1")) sessionStorage.setItem("m2p.mock.seed", p); sessionStorage.setItem("m2p.mock.config", JSON.stringify(c)); } catch { /* storage unavailable */ }
    window.__denyMic = d;
    const md = navigator.mediaDevices; if (!md) return;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = (cs) => (window.__denyMic ? Promise.reject(new DOMException("denied", "NotAllowedError")) : orig(cs));
  }, [persona, { latencyMs: 0, stageMs }, deny]);
  const page = await ctx.newPage();
  const hide = () => page.addStyleTag({ content: '[data-testid="mock-panel"],nextjs-portal{display:none !important}' });
  return { ctx, page, hide };
}

const ref = fs.readdirSync("docs/phase-2/reference/desktop").sort();
const name = (key) => ref.find((f) => f.includes(`-${key}.png`)) ?? `${key}.png`;

for (const [vpName, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 390, height: 844 }]]) {
  const dir = path.join(OUT, vpName); fs.mkdirSync(dir, { recursive: true });
  const shot = async (p, key) => { await p.page.waitForTimeout(500); await p.hide(); await p.page.screenshot({ path: path.join(dir, name(key)) }); console.log(vpName, name(key)); };
  const go = async (p, url, ready) => { await p.page.goto(BASE + url); if (ready) await p.page.waitForSelector(ready, { timeout: 60000 }); };
  const click = (p, role, nameRe) => p.page.getByRole(role, { name: nameRe }).first().click();

  // guest + onboarding
  let p = await session("signed_out", vp);
  await go(p, "/", "h1"); await shot(p, "s1-landing");
  await go(p, "/sign-in", "h1"); await shot(p, "s2-sign-in");
  await go(p, "/admin/sign-in", "h1"); await shot(p, "a0-owner-sign-in");
  await p.ctx.close();
  p = await session("new_student", vp);
  await go(p, "/onboarding/terms", "h1"); await shot(p, "s3-terms-first-time");
  await p.page.getByLabel(/I have read and agree/).check(); await click(p, "button", /^Continue$/); await p.page.waitForURL(/profile/);
  await p.page.waitForSelector("h1"); await shot(p, "s4-profile-setup");
  await p.ctx.close();

  // student with no history
  p = await session("student", vp, { stageMs: 1500 });
  await go(p, "/dashboard", "h1"); await shot(p, "s5-dashboard-empty");
  await go(p, "/history", "h1"); await shot(p, "s15-history-empty");
  await go(p, "/practice/new", "h1"); await shot(p, "s6-upload");
  await p.page.getByTestId("file-input").setInputFiles("tests/fixtures/deck-11.pdf"); await p.page.waitForSelector('[data-testid="upload-error"]'); await shot(p, "s6-upload-error");
  await p.page.getByTestId("file-input").setInputFiles("tests/fixtures/deck-3.pdf");
  await p.page.waitForURL(/reading/, { timeout: 60000 }); await p.page.waitForTimeout(2500); await shot(p, "s7-extracting");
  await p.ctx.close();

  // returning student: the 8-slide ParkSense deck (matches the prototype)
  p = await session("returning_student", vp, { stageMs: 200 });
  await go(p, "/dashboard", "h1"); await shot(p, "s5-dashboard-with-history");
  await go(p, "/history", '[data-testid="deck-row"]'); await shot(p, "s15-history");
  await click(p, "link", /ParkSense hackathon pitch/); await p.page.waitForSelector("text=Sub-scores by attempt"); await shot(p, "s16-deck-detail");
  await p.page.getByLabel("Attempts").getByText("Attempt 1").click(); await p.page.waitForSelector("text=Slide by slide"); await shot(p, "s14-report-attempt-1");
  await go(p, "/history", '[data-testid="deck-row"]'); await click(p, "link", /ParkSense hackathon pitch/);
  await p.page.getByLabel("Attempts").getByText("Attempt 2").click(); await p.page.waitForSelector("text=Slide by slide"); await shot(p, "s14-report-retake-74");
  await go(p, "/settings", "h1"); await shot(p, "s28-settings".replace("s28", "s17"));
  // flow screens via "Practice again"
  await go(p, "/history", '[data-testid="deck-row"]'); await click(p, "link", /ParkSense hackathon pitch/);
  const deckUrl = p.page.url();
  const deckId = deckUrl.split("/").pop();
  await go(p, `/practice/${deckId}/prepare`, "h1"); await p.page.waitForTimeout(800); await shot(p, "s8-slide-prep");
  await go(p, `/practice/${deckId}/time`, "h1"); await p.page.waitForTimeout(500); await shot(p, "s9-set-time");
  await click(p, "button", /Continue to mic check/); await p.page.waitForURL(/mic/); await p.page.waitForSelector("h1"); await shot(p, "s10-mic-check");
  await click(p, "button", /Allow microphone/); await p.page.waitForSelector("text=Microphone connected"); await p.page.waitForTimeout(800); await shot(p, "s10-mic-granted".replace("s10-mic-granted", "s10-mic-granted"));
  await click(p, "button", /Enter practice room/); await p.page.waitForSelector('button[aria-label="Record"]'); await p.page.waitForTimeout(800);
  await p.page.getByRole("button", { name: "Next slide" }).click(); await p.page.getByRole("button", { name: "Next slide" }).click();
  await shot(p, "s11-before-recording");
  await p.page.getByRole("button", { name: "Record", exact: true }).click(); await p.page.waitForTimeout(3500); await shot(p, "s11-recording");
  await p.page.getByRole("button", { name: "Stop", exact: true }).click(); await p.page.waitForTimeout(500); await shot(p, "s11-recorded");
  await p.page.getByRole("button", { name: "Re-record" }).click(); await p.page.waitForTimeout(41000); await shot(p, "s11-overrun-red");
  await p.page.getByRole("button", { name: "Stop", exact: true }).click();
  await p.page.getByRole("button", { name: "End session" }).click(); await p.page.waitForTimeout(400); await shot(p, "s11-leave-confirm");
  await p.page.getByRole("button", { name: "Keep practising" }).click();
  await p.page.getByRole("button", { name: "Review and submit" }).first().click(); await p.page.waitForSelector("text=Review and submit"); await p.page.waitForTimeout(500); await shot(p, "s12-review-some-missing");
  await p.ctx.close();
  // all slides recorded
  p = await session("returning_student", vp, { stageMs: 1200 });
  await go(p, "/history", '[data-testid="deck-row"]'); await click(p, "link", /ParkSense hackathon pitch/); await click(p, "button", /Practice again/);
  await click(p, "button", /Continue to mic check/); await click(p, "button", /Allow microphone/); await p.page.waitForSelector("text=Microphone connected"); await click(p, "button", /Enter practice room/);
  await p.page.waitForSelector('button[aria-label="Record"]');
  for (let i = 0; i < 8; i++) { await p.page.getByRole("button", { name: "Record", exact: true }).click(); await p.page.waitForTimeout(1200); await p.page.getByRole("button", { name: "Stop", exact: true }).click(); if (i < 7) await p.page.getByRole("button", { name: "Next slide" }).click(); }
  await p.page.getByRole("button", { name: "Review and submit" }).first().click(); await p.page.waitForSelector("text=Review and submit"); await p.page.waitForTimeout(500); await shot(p, "s12-review-all-recorded");
  await p.page.getByRole("button", { name: "Submit for feedback" }).click(); await p.page.waitForURL(/analysing/, { timeout: 60000 }); await p.page.waitForTimeout(2500); await shot(p, "s13-analysing");
  await p.ctx.close();
  // mic denied + limit + paused
  p = await session("returning_student", vp, { deny: true });
  await go(p, "/history", '[data-testid="deck-row"]'); await click(p, "link", /ParkSense hackathon pitch/); await click(p, "button", /Practice again/); await click(p, "button", /Continue to mic check/);
  await click(p, "button", /Allow microphone/); await p.page.waitForSelector("text=Microphone access is blocked"); await shot(p, "s10-mic-denied");
  await p.ctx.close();
  p = await session("at_limit", vp); await go(p, "/limit", "h1"); await shot(p, "s18-limit-reached"); await p.ctx.close();
  p = await session("blocked", vp); await go(p, "/paused", "h1"); await p.page.screenshot({ path: path.join(dir, "extra-blocked-paused.png") }); await p.ctx.close();
  // updated terms
  p = await session("returning_student", vp);
  await go(p, "/dashboard", "h1");
  await p.page.evaluate(() => window.__m2pMock.republishPolicy());
  await go(p, "/onboarding/terms", "text=We've updated our terms"); await shot(p, "s3-terms-updated"); await p.ctx.close();

  // admin
  p = await session("admin", vp);
  await go(p, "/admin", "h1"); await p.page.waitForTimeout(500); await shot(p, "a1-dashboard");
  await go(p, "/admin/students", "table, ul"); await shot(p, "a2-students");
  await click(p, "link", /View Ananya/); await p.page.waitForSelector("text=Practice attempts"); await shot(p, "a3-student-detail");
  await go(p, "/admin/ratings", "h1"); await shot(p, "a4-ratings");
  await go(p, "/admin/ai-usage", "h1"); await p.page.waitForTimeout(500); await shot(p, "a5-ai-usage");
  await go(p, "/admin/terms", "h1"); await p.page.waitForTimeout(500); await shot(p, "a6-terms-and-privacy");
  await p.page.getByLabel("Terms text").fill("## 1. Changed\nBody");
  await click(p, "button", /Publish new version/); await p.page.waitForTimeout(400); await p.hide(); await p.page.screenshot({ path: path.join(dir, "extra-a6-publish-dialog.png") });
  await p.ctx.close();
}
await browser.close();
console.log("done");
