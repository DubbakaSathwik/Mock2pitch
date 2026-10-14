import { expect, test as base } from "@playwright/test";

/** `test` that fails when the page logs a console error/warning or throws (no console noise in any journey). */
export const test = base.extend<{ allowConsole: RegExp[] }>({
  // Next.js route prefetch emits <link rel=preload as=style>; Chrome warns when the next page is not opened within seconds. Framework noise, not app behaviour.
  allowConsole: [[/was preloaded using link preload but not used/], { option: true }],
  page: async ({ page, allowConsole }, use) => {
    const problems: string[] = [];
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
