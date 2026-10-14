import path from "node:path";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const fixture = (name: string) => path.resolve("tests/fixtures", name);
export type Persona = "signed_out" | "new_student" | "student" | "returning_student" | "at_limit" | "blocked" | "admin";

/** Seeds the in-tab mock backend with a persona (only on the first load of the tab; reloads keep the session state). */
export async function seed(page: Page, persona: Persona, cfg: { latencyMs?: number; stageMs?: number; realtime?: boolean } = {}) {
  await page.addInitScript(([p, c]) => {
    try {
      if (!sessionStorage.getItem("m2p.mock.state.v1")) sessionStorage.setItem("m2p.mock.seed", p as string);
      sessionStorage.setItem("m2p.mock.config", JSON.stringify(c));
    } catch { /* ignore */ }
  }, [persona, { latencyMs: 0, stageMs: 120, ...cfg }]);
}

/** Lets a test deny the microphone once (getUserMedia rejects with NotAllowedError) and later allow it again. */
export async function micGate(page: Page, denied: boolean) {
  await page.addInitScript((d) => {
    (window as unknown as { __denyMic: boolean }).__denyMic = d as boolean;
    const md = navigator.mediaDevices;
    if (!md) return;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => ((window as unknown as { __denyMic: boolean }).__denyMic ? Promise.reject(new DOMException("Permission denied", "NotAllowedError")) : orig(c));
  }, denied);
}

export async function control(page: Page) {
  await page.waitForFunction(() => !!(window as unknown as { __m2pMock?: unknown }).__m2pMock);
  return {
    failNext: (plan: { kind: string; code: string } | null) => page.evaluate((p) => (window as any).__m2pMock.failNext(p), plan),
    failNextPuts: (n: number) => page.evaluate((x) => (window as any).__m2pMock.failNextPuts(x), n),
    republishPolicy: () => page.evaluate(() => (window as any).__m2pMock.republishPolicy()),
    breakAssetUrlsOnce: () => page.evaluate(() => (window as any).__m2pMock.breakAssetUrlsOnce()),
    setConfig: (c: object) => page.evaluate((x) => (window as any).__m2pMock.setConfig(x), c),
    snapshot: () => page.evaluate(() => (window as any).__m2pMock.snapshot()),
  };
}

/** axe: fails on serious/critical violations. */
export async function axeCheck(page: Page, label: string) {
  // dev-only widgets are not part of the product UI
  await page.addStyleTag({ content: '[data-testid="mock-panel"],nextjs-portal{display:none !important}' });
  const r = await new AxeBuilder({ page: page as never }).exclude('[data-testid="mock-panel"]').exclude("nextjs-portal").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  return { label, bad: bad.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")), help: v.help })) };
}

/** No horizontal scroll at the given width. */
export async function noHScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
}
