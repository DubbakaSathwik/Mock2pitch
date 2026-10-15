import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchRow } from "@/features/realtime/watch";

describe("realtime watcher with polling fallback", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function setup(opts: { isDone?: (v: number) => boolean } = {}) {
    let push: (v: number) => void = () => {};
    const unsub = vi.fn();
    let n = 0;
    const fetch = vi.fn(async () => ++n * 100);
    const seen: number[] = [];
    const stop = watchRow<number>({ subscribe: (cb) => { push = cb; return unsub; }, fetch, onValue: (v) => seen.push(v), ...opts });
    return { push: (v: number) => push(v), unsub, fetch, seen, stop };
  }

  it("fetches the current value first, then delivers realtime events", async () => {
    const w = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(w.seen).toEqual([100]);
    w.push(1); w.push(2);
    expect(w.seen).toEqual([100, 1, 2]);
    w.stop();
  });

  it("does not poll while events keep arriving", async () => {
    const w = setup();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 6; i++) { await vi.advanceTimersByTimeAsync(3000); w.push(i); }
    expect(w.fetch).toHaveBeenCalledTimes(1);
    w.stop();
  });

  it("falls back to polling every 3 s after 10 s without an event, and stops polling when an event returns", async () => {
    const w = setup();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(9000);
    expect(w.fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000); // 12 s: quiet for > 10 s → poll
    expect(w.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    const polled = w.fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(6000);
    expect(w.fetch.mock.calls.length).toBeGreaterThan(polled);
    w.push(999);
    const after = w.fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(6000);
    expect(w.fetch.mock.calls.length).toBe(after);
    w.stop();
  });

  it("stops and unsubscribes on a terminal value or when asked", async () => {
    const w = setup({ isDone: (v) => v === 7 });
    await vi.advanceTimersByTimeAsync(0);
    w.push(7);
    expect(w.unsub).toHaveBeenCalledTimes(1);
    w.push(8);
    expect(w.seen).toEqual([100, 7]);
    const w2 = setup();
    w2.stop(); w2.stop();
    expect(w2.unsub).toHaveBeenCalledTimes(1);
  });
});
