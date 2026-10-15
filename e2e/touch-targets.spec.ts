// Mobile: every tappable control is at least 44 × 44 px (inline text links inside sentences are exempt, per WCAG's inline exception).
import { expect, test } from "./fixtures";
import { seed, type Persona } from "./helpers";

const SCREENS: [Persona, string][] = [
  ["signed_out", "/"], ["signed_out", "/sign-in"], ["new_student", "/onboarding/terms"],
  ["returning_student", "/dashboard"], ["returning_student", "/practice/new"], ["returning_student", "/history"], ["returning_student", "/settings"],
  ["returning_student", "/reports/00000000-0000-4000-8000-00000000d001-rep2"], ["returning_student", "/history/00000000-0000-4000-8000-00000000d001"],
  ["returning_student", "/practice/00000000-0000-4000-8000-00000000d001/prepare"], ["returning_student", "/practice/00000000-0000-4000-8000-00000000d001/time"],
  ["at_limit", "/limit"], ["blocked", "/paused"],
  ["admin", "/admin"], ["admin", "/admin/students"], ["admin", "/admin/ratings"], ["admin", "/admin/ai-usage"], ["admin", "/admin/terms"],
];

test("mobile: tappable controls are at least 44px", async ({ browser, isMobile }) => {
  test.skip(!isMobile, "mobile-only check");
  test.setTimeout(300_000);
  const bad: string[] = [];
  for (const [persona, url] of SCREENS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await ctx.newPage();
    await seed(page, persona, { latencyMs: 0 });
    await page.goto(url);
    await page.waitForSelector("h1", { timeout: 30_000 });
    await page.waitForTimeout(600);
    const small = await page.evaluate(() => {
      const sel = 'button, [role="button"], [role="tab"], [role="radio"], input:not([type="hidden"]), select, textarea, summary, a';
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        if (el.closest('[data-testid="mock-panel"], nextjs-portal')) continue;
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        if (el.matches("a") && (cs.display === "inline" || el.classList.contains("skip-link") || el.closest(".sr-only"))) continue; // inline links in text; skip link
        if (el.matches('input[type="checkbox"], input[type="radio"]') && el.closest("label")) continue; // the label is the target
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 43.5 || r.height < 43.5) out.push(`${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    for (const s of small) bad.push(`${url}: ${s}`);
    await ctx.close();
  }
  expect(bad, bad.join("\n")).toEqual([]);
});
