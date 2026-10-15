import type { Page } from "@playwright/test";

// Dev-server and framework noise that is not application behaviour (never present in a production build).
const ALLOW = [/was preloaded using link preload but not used/, /\[Fast Refresh\] performing full reload/, /Download the React DevTools/, /\[HMR\] connected/];

/** Collects console errors/warnings and failed requests; `errors()` returns what the test must treat as failures. */
export function watchConsole(page: Page, extraAllow: RegExp[] = []) {
  const found: string[] = [];
  const allow = [...ALLOW, ...extraAllow];
  page.on("console", (m) => { if (m.type() !== "error" && m.type() !== "warning") return; const t = m.text(); if (!allow.some((r) => r.test(t))) found.push(`${m.type()}: ${t.slice(0, 300)}`); });
  page.on("pageerror", (e) => found.push(`pageerror: ${e.message.slice(0, 300)}`));
  return { errors: () => found, clear: () => { found.length = 0; } };
}
