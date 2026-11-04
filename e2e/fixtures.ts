import { expect, test as base } from "@playwright/test";

/** `test` that fails when the page logs a console error/warning or throws (no console noise in any journey). */
export const test = base.extend<{ allowConsole: RegExp[] }>({
  // Next.js route prefetch emits <link rel=preload as=style>; Chrome warns when the next page is not opened within seconds. Framework noise, not app behaviour.
  // The Next *dev* server logs "[Fast Refresh] performing full reload" when it compiles a route for the first time while the test keeps navigating
  // (it cannot occur in a production build).
  allowConsole: [[/was preloaded using link preload but not used/, /\[Fast Refresh\] performing full reload/], { option: true }],
  page: async ({ page, allowConsole }, use) => {
    const problems: string[] = [];
    // The Next.js *dev* overlay (badge / error portal, bottom-left) can sit on top of a control and swallow Playwright's clicks ("<nextjs-portal> intercepts
    // pointer events"). It does not exist in a production build, so it is hidden in every journey.
    await page.addInitScript(() => {
      const hide = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none !important}"; (document.head ?? document.documentElement).appendChild(st); };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide); else hide();
    });
    page.on("console", (m) => {
      if (m.type() !== "error" && m.type() !== "warning") return;
      const line = `${m.type()}: ${m.text()} (${m.location().url})`;
      if (allowConsole.some((r) => r.test(line))) return;
      problems.push(line);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    await use(page);
    expect(problems, "console errors / warnings").toEqual([]);
  },
});
export { expect };
