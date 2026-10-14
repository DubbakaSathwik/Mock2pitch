// Accessibility + layout sweep: axe (WCAG 2.2 AA tags, serious/critical = failure) on every screen/state, at desktop and mobile
// widths, plus "no horizontal scroll" at 320 / 390 / 760 / 1024 / 1440 px.
import path from "node:path";
import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { axeCheck, fixture, noHScroll, type Persona } from "./helpers";

const VIEWPORTS = [{ name: "desktop", width: 1280, height: 800 }, { name: "mobile", width: 390, height: 844 }];
type Finding = { screen: string; viewport: string; bad: unknown[] };

async function open(browser: Browser, persona: Persona, vp: { width: number; height: number }, stageMs = 150) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, permissions: ["microphone"], hasTouch: vp.width < 760 });
  await ctx.addInitScript(([p, c]) => { try { if (!sessionStorage.getItem("m2p.mock.state.v1")) sessionStorage.setItem("m2p.mock.seed", p as string); sessionStorage.setItem("m2p.mock.config", JSON.stringify(c)); } catch { /* */ } }, [persona, { latencyMs: 0, stageMs }]);
  const page = await ctx.newPage();
  return { ctx, page };
}

async function check(page: Page, found: Finding[], screen: string, vp: string, ready?: () => Promise<unknown>) {
  if (ready) await ready();
  await page.waitForTimeout(250);
  const r = await axeCheck(page, screen);
  if (r.bad.length) found.push({ screen, viewport: vp, bad: r.bad });
  if (!(await noHScroll(page))) found.push({ screen, viewport: vp, bad: [{ id: "horizontal-scroll" }] });
}

for (const vp of VIEWPORTS) {
  test(`axe sweep (${vp.name} ${vp.width}px): every screen and state`, async ({ browser }) => {
    test.setTimeout(600_000);
    const found: Finding[] = [];
    const v = vp.name;

    // ---- guest
    {
      const { ctx, page } = await open(browser, "signed_out", vp);
      for (const [p, h] of [["/", /Rehearse your pitch/], ["/sign-in", /Welcome back/], ["/admin/sign-in", /Owner sign in/], ["/terms", /Terms/], ["/privacy", /Privacy Policy/]] as const) {
        await page.goto(p);
        await check(page, found, `guest ${p}`, v, () => expect(page.getByRole("heading", { level: 1, name: h })).toBeVisible());
      }
      await ctx.close();
    }
    // ---- onboarding
    {
      const { ctx, page } = await open(browser, "new_student", vp);
      await page.goto("/onboarding/terms");
      await check(page, found, "S3 terms (first time)", v, () => expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible());
      await page.getByLabel("I have read and agree to the Terms and the Privacy Policy").check();
      await page.getByRole("button", { name: "Continue" }).click();
      await check(page, found, "S4 profile", v, () => expect(page.getByRole("heading", { name: "Tell us a little about you" })).toBeVisible());
      await page.getByRole("button", { name: "Save and continue" }).click();
      await check(page, found, "S4 profile (error)", v, () => expect(page.getByText("Enter your college name")).toBeVisible());
      await ctx.close();
    }
    // ---- limit, paused, updated terms
    {
      const { ctx, page } = await open(browser, "at_limit", vp);
      await page.goto("/limit");
      await check(page, found, "S18 limit", v, () => expect(page.getByRole("heading", { level: 1, name: /Time to rest/ })).toBeVisible());
      await ctx.close();
      const b = await open(browser, "blocked", vp);
      await b.page.goto("/paused");
      await check(b.page, found, "blocked /paused", v, () => expect(b.page.getByRole("heading", { level: 1, name: "Your account is paused" })).toBeVisible());
      await b.page.goto("/settings");
      await check(b.page, found, "S17 settings (blocked)", v, () => expect(b.page.getByText("Your account is paused").first()).toBeVisible());
      await b.ctx.close();
    }
    // ---- first-time student: empty states, upload, error, flow, room, review
    {
      const { ctx, page } = await open(browser, "student", vp, 700);
      await page.goto("/dashboard");
      await check(page, found, "S5 dashboard (empty)", v, () => expect(page.getByText("Your first practice starts here")).toBeVisible());
      await page.goto("/history");
      await check(page, found, "S15 history (empty)", v, () => expect(page.getByText("No reports yet")).toBeVisible());
      await page.goto("/practice/new");
      await check(page, found, "S6 upload (idle)", v, () => expect(page.getByRole("heading", { level: 1, name: "Upload your slides" })).toBeVisible());
      await page.getByTestId("file-input").setInputFiles(fixture("deck-11.pdf"));
      await check(page, found, "S6 upload (error)", v, () => expect(page.getByTestId("upload-error")).toBeVisible());
      await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
      await page.waitForURL(/\/reading|\/prepare/, { timeout: 60_000 });
      if (/reading/.test(page.url())) await check(page, found, "S7 reading", v, () => expect(page.getByRole("heading", { level: 1 })).toBeVisible());
      await page.waitForURL(/\/prepare/, { timeout: 60_000 });
      await check(page, found, "S8 prepare", v, () => expect(page.getByRole("heading", { level: 1, name: "Prepare your slides" })).toBeVisible());
      await page.getByRole("button", { name: "Continue to set time" }).click();
      await check(page, found, "S9 time", v, () => expect(page.getByRole("heading", { level: 1, name: "Set your time" })).toBeVisible());
      await page.getByLabel("Total duration (minutes)").fill("0");
      await check(page, found, "S9 time (error)", v, () => expect(page.getByText("Enter at least 1 minute")).toBeVisible());
      await page.getByLabel("Total duration (minutes)").fill("1");
      await page.getByRole("button", { name: "Continue to mic check" }).click();
      await check(page, found, "S10 mic (idle)", v, () => expect(page.getByRole("button", { name: "Allow microphone" })).toBeVisible());
      await page.getByRole("button", { name: "Allow microphone" }).click();
      await check(page, found, "S10 mic (granted)", v, () => expect(page.getByText("Microphone connected")).toBeVisible());
      await page.getByRole("button", { name: "Enter practice room" }).click();
      await check(page, found, "S11 room (before recording)", v, () => expect(page.getByRole("button", { name: "Record", exact: true })).toBeVisible());
      await page.getByRole("button", { name: "Record", exact: true }).click();
      await check(page, found, "S11 room (recording)", v, () => expect(page.getByText("Recording slide 1").first()).toBeVisible());
      await page.waitForTimeout(1500);
      await page.getByRole("button", { name: "Stop", exact: true }).click();
      await page.getByRole("button", { name: "End session" }).click();
      await check(page, found, "S11 room (leave dialog)", v, () => expect(page.getByRole("dialog")).toBeVisible());
      await page.getByRole("button", { name: "Keep practising" }).click();
      await page.getByRole("button", { name: "Review and submit" }).first().click();
      await check(page, found, "S12 review", v, () => expect(page.getByRole("heading", { level: 1, name: "Review and submit" })).toBeVisible());
      await page.getByRole("button", { name: "Submit for feedback" }).click();
      await page.getByRole("button", { name: "Submit anyway" }).click();
      await page.waitForURL(/\/analysing|\/reports/, { timeout: 60_000 });
      if (/analysing/.test(page.url())) await check(page, found, "S13 analysing", v, () => expect(page.getByTestId("analysis-stage")).toBeVisible());
      await ctx.close();
    }
    // ---- returning student: with-history screens, report, dialogs
    {
      const { ctx, page } = await open(browser, "returning_student", vp);
      await page.goto("/dashboard");
      await check(page, found, "S5 dashboard (history)", v, () => expect(page.getByText("Recent decks")).toBeVisible());
      await page.goto("/history");
      await check(page, found, "S15 history", v, () => expect(page.getByTestId("deck-row")).toHaveCount(1));
      await page.getByRole("link", { name: "ParkSense hackathon pitch" }).click();
      await check(page, found, "S16 deck detail", v, () => expect(page.getByText("Sub-scores by attempt")).toBeVisible());
      await page.getByLabel("Attempts").getByText("Attempt 2").click();
      await check(page, found, "S14 report (attempt 2)", v, () => expect(page.getByText("Slide by slide")).toBeVisible());
      await page.getByRole("button", { name: /How it works/ }).click();
      await check(page, found, "S14 report (accordion open)", v, () => expect(page.getByText("Transcript").first()).toBeVisible());
      await page.goto("/settings");
      await check(page, found, "S17 settings", v, () => expect(page.getByRole("heading", { level: 1, name: "Profile and settings" })).toBeVisible());
      await page.getByRole("button", { name: "Delete account" }).click();
      await check(page, found, "S17 delete dialog", v, () => expect(page.getByRole("dialog", { name: "Delete your account?" })).toBeVisible());
      await ctx.close();
    }
    // ---- admin
    {
      const { ctx, page } = await open(browser, "admin", vp);
      for (const [p, h] of [["/admin", "Overview"], ["/admin/students", "Students"], ["/admin/ratings", "Report ratings"], ["/admin/ai-usage", "AI usage and credits"], ["/admin/terms", "Terms and Privacy Policy"]] as const) {
        await page.goto(p);
        await check(page, found, `admin ${p}`, v, () => expect(page.getByRole("heading", { level: 1, name: h })).toBeVisible());
      }
      await page.goto("/admin/students");
      await page.getByRole("link", { name: /^View Ananya Rao/ }).click();
      await check(page, found, "A3 student detail", v, () => expect(page.getByLabel("Practice attempts")).toBeVisible());
      await page.goto("/admin/terms");
      await page.getByLabel("Terms text").fill("## 1. Changed\nBody");
      await page.getByRole("button", { name: "Publish new version" }).click();
      await check(page, found, "A6 publish dialog", v, () => expect(page.getByRole("dialog", { name: "Publish a new version?" })).toBeVisible());
      await ctx.close();
    }
    const summary = found.map((f) => `${f.viewport} · ${f.screen}: ${JSON.stringify(f.bad)}`).join("\n");
    expect(found.length, `violations:\n${summary}`).toBe(0);
  });
}

test("no horizontal scroll at 320 / 390 / 760 / 1024 / 1440 px on the static screens", async ({ browser }) => {
  test.setTimeout(300_000);
  const widths = [320, 390, 760, 1024, 1440];
  const bad: string[] = [];
  for (const [persona, paths] of [["signed_out", ["/", "/sign-in", "/terms"]], ["returning_student", ["/dashboard", "/history", "/settings", "/practice/new"]], ["admin", ["/admin", "/admin/students", "/admin/ai-usage", "/admin/terms"]]] as const) {
    const { ctx, page } = await open(browser, persona, { width: 1280, height: 800 });
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 800 });
      for (const p of paths) {
        await page.goto(p);
        await page.waitForTimeout(400);
        if (!(await noHScroll(page))) bad.push(`${persona} ${p} @${w}px`);
      }
    }
    await ctx.close();
  }
  void path;
  expect(bad).toEqual([]);
});
