// Realtime with a polling fallback: subscribe to change events; if no event arrives for `quietMs` start polling every `pollMs`
// until an event is seen again. The first value is always fetched (realtime does not replay current state).
import type { Unsubscribe } from "@/lib/data/types";

export type WatchOptions<T> = {
  subscribe: (cb: (v: T) => void) => Unsubscribe;
  fetch: () => Promise<T>;
  onValue: (v: T) => void;
  onError?: (e: unknown) => void;
  /** Stop watching when this returns true (e.g. terminal status). */
  isDone?: (v: T) => boolean;
  quietMs?: number; pollMs?: number;
  now?: () => number;
};

export function watchRow<T>(o: WatchOptions<T>): () => void {
  const quietMs = o.quietMs ?? 10_000, pollMs = o.pollMs ?? 3_000, now = o.now ?? Date.now;
  let stopped = false;
  let lastEventAt = now();
  let polling = false;
  const deliver = (v: T) => { if (stopped) return; o.onValue(v); if (o.isDone?.(v)) stop(); };
  const unsub = o.subscribe((v) => { lastEventAt = now(); polling = false; deliver(v); });
  const pull = () => { o.fetch().then(deliver).catch((e) => { if (!stopped) o.onError?.(e); }); };
  pull();
  const timer = setInterval(() => {
    if (stopped) return;
    if (!polling && now() - lastEventAt >= quietMs) polling = true;
    if (polling) pull();
  }, pollMs);
  function stop() { if (stopped) return; stopped = true; clearInterval(timer); unsub(); }
  return stop;
}
