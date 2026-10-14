// Renders the 8 seeded ParkSense slides (design prototype look) to 1280x720 JPEGs under public/mock/slides/.
// Usage: npx tsx scripts/gen-mock-slides.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PARKSENSE } from "../lib/data/mock/seed-content.ts";

const fonts = path.resolve("docs/design-handoff/design_handoff_mock2pitch/prototype/design-system/fonts");
const html = (i) => {
  const s = PARKSENSE[i];
  const edge = i === 0 || i === 7;
  return `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"Autour One";src:url("file://${fonts}/AutourOne-Regular.ttf")}
@font-face{font-family:"LXGW WenKai TC";src:url("file://${fonts}/LXGWWenKaiTC-Regular.ttf")}
html,body{margin:0}
.s{width:1280px;height:720px;background:#fff;position:relative;overflow:hidden;container-type:inline-size;font-family:"LXGW WenKai TC",serif}
.bar{position:absolute;left:0;top:0;bottom:0;width:2.2%;background:${edge ? "#0A2472" : "#0E6BA8"}}
.in{padding:7% 8%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:${edge ? "center" : "flex-start"}}
.t{font-family:"Autour One",sans-serif;font-size:${edge ? "7cqw" : "5.4cqw"};color:#0A2472;line-height:1.1;margin-bottom:4cqw}
.b{display:flex;gap:1.6cqw;align-items:baseline;font-size:3.4cqw;color:#2E3557;margin-bottom:1.8cqw}
.d{width:1.1cqw;height:1.1cqw;border-radius:50%;background:#0E6BA8;flex-shrink:0;transform:translateY(-.3cqw)}
.n{position:absolute;right:3%;bottom:3%;font-size:2.2cqw;color:#9196AE}
</style><div class="s"><div class="bar"></div><div class="in"><div class="t">${s.title}</div>${s.bullets.map((b) => `<div class="b">${i !== 0 ? '<span class="d"></span>' : ""}${b}</div>`).join("")}</div><div class="n">${i + 1}</div></div>`;
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const tmp = path.join(os.tmpdir(), "m2p-slide.html");
for (let i = 0; i < PARKSENSE.length; i++) {
  fs.writeFileSync(tmp, html(i));
  await page.goto("file://" + tmp);
  await page.evaluate(() => document.fonts.ready);
  const out = `public/mock/slides/parksense-${i + 1}.jpg`;
  await page.screenshot({ path: out, type: "jpeg", quality: 80 });
  console.log(out, fs.statSync(out).size);
}
fs.copyFileSync("public/mock/slides/parksense-4.jpg", "public/landing/room-slide.jpg");
await browser.close();
