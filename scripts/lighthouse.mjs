// Lighthouse (mobile emulation, simulated slow-4G) against a PRODUCTION build running in mock mode.
// Usage: npm run build:review && npx next start -p 3200 &  then:  node scripts/lighthouse.mjs
import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3200";
const PORT = 9333;
const pages = [
  ["Landing", "/"],
  ["Dashboard", "/dashboard?persona=returning_student"],
  ["Report", "/reports/00000000-0000-4000-8000-00000000d001-rep2?persona=returning_student"],
];
const browser = await chromium.launch({ args: [`--remote-debugging-port=${PORT}`] });
const out = [];
for (const formFactor of ["mobile", "desktop"]) {
  for (const [name, p] of pages) {
    const r = await lighthouse(BASE + p, { port: PORT, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"], formFactor, screenEmulation: formFactor === "mobile" ? undefined : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttlingMethod: "simulate" });
    const c = r.lhr.categories, a = r.lhr.audits;
    const row = { page: name, formFactor, performance: Math.round(c.performance.score * 100), accessibility: Math.round(c.accessibility.score * 100), bestPractices: Math.round(c["best-practices"].score * 100), seo: Math.round(c.seo.score * 100),
      lcp_ms: Math.round(a["largest-contentful-paint"].numericValue), cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)), tbt_ms: Math.round(a["total-blocking-time"].numericValue), finalUrl: r.lhr.finalDisplayedUrl };
    console.log(JSON.stringify(row));
    out.push(row);
  }
}
await browser.close();
fs.writeFileSync("docs/phase-2/lighthouse.json", JSON.stringify(out, null, 2) + "\n");
