// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [persona]
import { chromium } from "@playwright/test";
const [url, out, w = "1280", h = "800", persona = ""] = process.argv.slice(2);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h } });
if (persona) await ctx.addInitScript((p) => { if (!sessionStorage.getItem("m2p.mock.state.v1")) sessionStorage.setItem("m2p.mock.seed", p); sessionStorage.setItem("m2p.mock.config", JSON.stringify({ latencyMs: 0, stageMs: 100 })); }, persona);
const page = await ctx.newPage();
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) console.log("console." + m.type(), m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 300)));
await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: false });
await b.close();
