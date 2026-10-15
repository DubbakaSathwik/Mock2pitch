import { registerMockPutTransport } from "@/lib/upload/put";
import { MockBackend, STORAGE_KEYS, type MockConfig, type MockControl } from "./adapter";
import { PERSONAS, type PersonaId } from "./state";
import type { DataPort } from "../types";

export { MockBackend, type MockConfig, type MockControl } from "./adapter";
export { PERSONAS, PERSONA_LABEL, type PersonaId } from "./state";

export type MockInstance = { data: DataPort; control: MockControl; backend: MockBackend };

/** Creates an isolated mock backend (used by unit tests and by the browser singleton). */
export function createMockData(opts: { storage?: Storage | null; persona?: PersonaId; config?: Partial<MockConfig>; now?: () => Date; registerTransport?: boolean } = {}): MockInstance {
  const backend = new MockBackend(opts);
  if (opts.registerTransport !== false) registerMockPutTransport((t, body, o) => backend.blobs.put(t, body, o));
  return { data: backend.port, control: backend.control, backend };
}

let browser: MockInstance | null = null;
declare global { interface Window { __m2pMock?: MockControl } }

/**
 * `?persona=<id>` seeds (or switches) the tab's persona, e.g. `/dashboard?persona=returning_student`. It only acts when the requested
 * persona differs from the one already in the tab's session, so reloading the same URL keeps the session state. Used by the review
 * deploy (which has no mock panel), Lighthouse and the screen-capture script.
 */
function applyPersonaParam(storage: Storage | null) {
  try {
    const id = new URLSearchParams(window.location.search).get("persona");
    if (!storage || !id || !(PERSONAS as readonly string[]).includes(id)) return;
    const saved = storage.getItem(STORAGE_KEYS.state);
    const current = saved ? (JSON.parse(saved) as { persona?: string }).persona : null;
    if (current !== id) storage.setItem(STORAGE_KEYS.seed, id);
  } catch { /* ignore: the persona simply stays as is */ }
}

/** One mock backend per tab, persisted in sessionStorage so a page refresh keeps the session (recordings and slide images are not persisted). */
export function getBrowserMock(): MockInstance {
  if (browser) return browser;
  let storage: Storage | null = null;
  try { storage = window.sessionStorage; } catch { storage = null; }
  applyPersonaParam(storage);
  browser = createMockData({ storage });
  if (process.env.NODE_ENV !== "production") window.__m2pMock = browser.control;
  return browser;
}
