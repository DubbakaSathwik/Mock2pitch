import { registerMockPutTransport } from "@/lib/upload/put";
import { MockBackend, type MockConfig, type MockControl } from "./adapter";
import type { PersonaId } from "./state";
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

/** One mock backend per tab, persisted in sessionStorage so a page refresh keeps the session (recordings and slide images are not persisted). */
export function getBrowserMock(): MockInstance {
  if (browser) return browser;
  let storage: Storage | null = null;
  try { storage = window.sessionStorage; } catch { storage = null; }
  browser = createMockData({ storage });
  if (process.env.NODE_ENV !== "production") window.__m2pMock = browser.control;
  return browser;
}
