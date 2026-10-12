import { beforeEach, describe, expect, it } from "vitest";
import { routeCall, TransportError, type RouterStore, type SlotState, type Transport, type UsageEntry } from "@shared/nvidia/router.ts";
import { AppError } from "@shared/http.ts";
import type { Slot } from "@shared/constants.ts";

class FakeStore implements RouterStore {
  states: SlotState[]; logs: UsageEntry[] = []; cooldowns: Record<string, { until: Date; code: string | null }> = {};
  constructor(overrides: Partial<Record<Slot, Partial<SlotState>>> = {}) {
    this.states = (["primary", "fallback_1", "fallback_2"] as Slot[]).map((slot) => ({
      id: `id-${slot}`, slot, cooldownUntil: null, creditLimit: 1000, usedCredits: 0, requestsLast60s: 0, ...overrides[slot],
    }));
  }
  async slotStates() { return this.states; }
  async setCooldown(id: string, until: Date, code: string | null) { this.cooldowns[id] = { until, code }; }
  async log(e: UsageEntry) { this.logs.push(e); }
}

const keys = [{ slot: "primary" as Slot, key: "k0" }, { slot: "fallback_1" as Slot, key: "k1" }, { slot: "fallback_2" as Slot, key: "k2" }];
const base = (store: RouterStore, transport: Transport, extra: Record<string, unknown> = {}) => ({
  purpose: "report_generation" as const, model: "m", keys, store, transport, timeoutMs: 1000, rpmSoftLimit: 35,
  validate: (b: unknown) => (b as { v: number }).v, ...extra,
});
const respond = (map: Record<string, { status: number; headers?: Record<string, string>; body?: unknown }>): Transport =>
  async ({ key }) => { const r = map[key]!; return { status: r.status, headers: r.headers ?? {}, body: r.body ?? { v: 1 } }; };

describe("routeCall", () => {
  let store: FakeStore;
  beforeEach(() => { store = new FakeStore(); });

  it("uses the primary key normally and logs the attempt", async () => {
    const used: string[] = [];
    const t: Transport = async ({ key }) => { used.push(key); return { status: 200, headers: {}, body: { v: 7 }, usage: { promptTokens: 5, completionTokens: 6 } }; };
    expect(await routeCall(base(store, t))).toBe(7);
    expect(used).toEqual(["k0"]);
    expect(store.logs).toHaveLength(1);
    expect(store.logs[0]).toMatchObject({ slotId: "id-primary", outcome: "success", httpStatus: 200, promptTokens: 5 });
  });

  it("429 sets cooldown from Retry-After and falls through to fallback 1 immediately", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const t = respond({ k0: { status: 429, headers: { "Retry-After": "17" } }, k1: { status: 200, body: { v: 2 } } });
    expect(await routeCall(base(store, t, { now: () => now }))).toBe(2);
    expect(store.cooldowns["id-primary"]!.until.getTime()).toBe(now.getTime() + 17_000);
    expect(store.logs.map((l) => l.outcome)).toEqual(["rate_limited", "success"]);
  });

  it("defaults the 429 cooldown to 60s", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    await routeCall(base(store, respond({ k0: { status: 429 }, k1: { status: 200 } }), { now: () => now }));
    expect(store.cooldowns["id-primary"]!.until.getTime()).toBe(now.getTime() + 60_000);
  });

  it("429 on every slot -> AI_BUSY", async () => {
    const t = respond({ k0: { status: 429 }, k1: { status: 429 }, k2: { status: 429 } });
    await expect(routeCall(base(store, t))).rejects.toMatchObject({ code: "AI_BUSY", status: 429 });
    expect(store.logs).toHaveLength(3);
  });

  it("400 does not rotate keys", async () => {
    const calls: string[] = [];
    const t: Transport = async ({ key }) => { calls.push(key); return { status: 400, headers: {}, body: {} }; };
    await expect(routeCall(base(store, t))).rejects.toMatchObject({ code: "bad_request" });
    expect(calls).toEqual(["k0"]);
    expect(store.logs[0]!.outcome).toBe("bad_request");
  });

  it("401 flags the slot (auth, 10 min) and tries the next", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(await routeCall(base(store, respond({ k0: { status: 401 }, k1: { status: 200, body: { v: 3 } } }), { now: () => now }))).toBe(3);
    expect(store.cooldowns["id-primary"]).toEqual({ until: new Date(now.getTime() + 600_000), code: "auth" });
  });

  it("5xx, timeouts and network errors cool down 30s and rotate", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const t: Transport = async ({ key }) => {
      if (key === "k0") return { status: 503, headers: {}, body: {} };
      if (key === "k1") throw new TransportError("timeout");
      return { status: 200, headers: {}, body: { v: 9 } };
    };
    expect(await routeCall(base(store, t, { now: () => now }))).toBe(9);
    expect(store.cooldowns["id-primary"]!.until.getTime()).toBe(now.getTime() + 30_000);
    expect(store.cooldowns["id-fallback_1"]!.until.getTime()).toBe(now.getTime() + 30_000);
    expect(store.logs.map((l) => l.outcome)).toEqual(["server_error", "timeout", "success"]);
  });

  it("skips slots in cooldown, over the RPM soft limit, or out of credits", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    store = new FakeStore({
      primary: { cooldownUntil: new Date(now.getTime() + 1000) },
      fallback_1: { requestsLast60s: 35 },
    });
    const used: string[] = [];
    await routeCall(base(store, async ({ key }) => { used.push(key); return { status: 200, headers: {}, body: { v: 1 } }; }, { now: () => now }));
    expect(used).toEqual(["k2"]);

    store = new FakeStore({ primary: { usedCredits: 1000 }, fallback_1: { usedCredits: 5000, creditLimit: 5000 }, fallback_2: { usedCredits: 1 } });
    used.length = 0;
    await routeCall(base(store, async ({ key }) => { used.push(key); return { status: 200, headers: {}, body: { v: 1 } }; }));
    expect(used).toEqual(["k2"]);
  });

  it("an expired cooldown is eligible again", async () => {
    const now = new Date("2026-01-01T00:00:00Z");
    store = new FakeStore({ primary: { cooldownUntil: new Date(now.getTime() - 1) } });
    const used: string[] = [];
    await routeCall(base(store, async ({ key }) => { used.push(key); return { status: 200, headers: {}, body: { v: 1 } }; }, { now: () => now }));
    expect(used).toEqual(["k0"]);
  });

  it("only configured slots are used (empty env skipped)", async () => {
    const used: string[] = [];
    await routeCall(base(store, async ({ key }) => { used.push(key); return { status: 200, headers: {}, body: { v: 1 } }; }, { keys: [keys[2]] }));
    expect(used).toEqual(["k2"]);
  });

  it("no configured keys -> AI_BUSY", async () => {
    await expect(routeCall(base(store, respond({}), { keys: [] }))).rejects.toMatchObject({ code: "AI_BUSY" });
  });

  it("invalid output is logged as billable invalid_output and does not rotate", async () => {
    const used: string[] = [];
    const t: Transport = async ({ key }) => { used.push(key); return { status: 200, headers: {}, body: { nope: true } }; };
    const err = await routeCall(base(store, t, { validate: () => { throw new Error("bad"); } })).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("invalid_output");
    expect(used).toEqual(["k0"]);
    expect(store.logs[0]!.outcome).toBe("invalid_output");
  });

  it("carries user/deck/session ids into the log, never keys", async () => {
    await routeCall(base(store, respond({ k0: { status: 200 } }), { ctx: { userId: "u", deckId: "d", sessionId: null } }));
    expect(store.logs[0]).toMatchObject({ userId: "u", deckId: "d", sessionId: null });
    expect(JSON.stringify(store.logs)).not.toContain("k0");
  });
});
