// NVIDIA key routing (§7.2). Pure logic over an injected store + transport so it is unit-testable.
import { COOLDOWN_5XX_S, COOLDOWN_AUTH_S, DEFAULT_COOLDOWN_429_S, SAME_KEY_RETRY_DELAYS_MS, type Purpose, type Slot } from "../constants.ts";
import { AppError, Errors } from "../http.ts";

export type Outcome = "success" | "rate_limited" | "server_error" | "timeout" | "bad_request" | "invalid_output";
/** Outcomes that consume NVIDIA credits (documented in docs/phase-1/ai.md). */
export const BILLABLE_OUTCOMES: Outcome[] = ["success", "invalid_output"];

export type SlotState = {
  id: string; slot: Slot; cooldownUntil: Date | null; creditLimit: number; usedCredits: number; requestsLast60s: number;
};
export type UsageEntry = {
  purpose: Purpose; slotId: string; model: string; outcome: Outcome; httpStatus: number | null; latencyMs: number;
  promptTokens?: number | null; completionTokens?: number | null; audioMs?: number | null;
  userId?: string | null; deckId?: string | null; sessionId?: string | null;
};
export interface RouterStore {
  slotStates(purpose: Purpose): Promise<SlotState[]>;
  setCooldown(slotId: string, until: Date, errorCode: string | null): Promise<void>;
  log(entry: UsageEntry): Promise<void>;
}
export type TransportResult = {
  status: number; headers: Record<string, string>; body: unknown;
  usage?: { promptTokens?: number; completionTokens?: number; audioMs?: number };
};
export type Transport = (req: { key: string; slot: Slot; timeoutMs: number }) => Promise<TransportResult>;
/** Transports signal timeouts/network failures by throwing this. */
export class TransportError extends Error { constructor(public kind: "timeout" | "network", public detail?: string) { super(kind); } }

export type RouteOptions<T> = {
  purpose: Purpose; model: string; keys: { slot: Slot; key: string }[]; store: RouterStore; transport: Transport;
  timeoutMs: number; rpmSoftLimit: number; ctx?: { userId?: string | null; deckId?: string | null; sessionId?: string | null };
  now?: () => Date;
  /** Injectable pause for the same-key retry (tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Parse/validate the body. Throw to signal invalid model output (billable, not rotated). */
  validate: (body: unknown) => T;
};

export class InvalidOutputError extends AppError {
  constructor() { super("invalid_output", 502, "The AI returned an unusable answer."); }
}

function retryAfterSeconds(h: Record<string, string>): number {
  const v = Object.entries(h).find(([k]) => k.toLowerCase() === "retry-after")?.[1];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.ceil(n), 3600) : DEFAULT_COOLDOWN_429_S;
}

export async function routeCall<T>(o: RouteOptions<T>): Promise<T> {
  const now = o.now ?? (() => new Date());
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const states = await o.store.slotStates(o.purpose);
  const byslot = new Map(states.map((s) => [s.slot, s]));
  const eligible = (slot: Slot) => {
    const st = byslot.get(slot);
    if (!st) return false;
    if (st.cooldownUntil && st.cooldownUntil.getTime() > now().getTime()) return false;
    if (st.requestsLast60s >= o.rpmSoftLimit) return false;
    if (st.usedCredits >= st.creditLimit) return false;
    return true;
  };
  const eligibleKeys = o.keys.filter((k) => eligible(k.slot)); // o.keys is already ordered primary -> fallback_1 -> fallback_2
  for (let i = 0; i < eligibleKeys.length; i++) {
    const { slot, key } = eligibleKeys[i]!;
    const st = byslot.get(slot)!;
    const isLast = i === eligibleKeys.length - 1;
    const base = { purpose: o.purpose, slotId: st.id, model: o.model, ...o.ctx };
    // A transient 5xx / network error on the LAST usable key is retried a few times on the same key (with growing pauses) before the key is
    // cooled down: with a single key per purpose the cooldown would otherwise turn one blip into 30 s of "AI busy" (observed live: 503 on the report model).
    for (let attempt = 0; attempt <= SAME_KEY_RETRY_DELAYS_MS.length; attempt++) {
      const t0 = Date.now();
      let res: TransportResult;
      try {
        res = await o.transport({ key, slot, timeoutMs: o.timeoutMs });
      } catch (e) {
        const kind = e instanceof TransportError ? e.kind : "network";
        await o.store.log({ ...base, outcome: kind === "timeout" ? "timeout" : "server_error", httpStatus: null, latencyMs: Date.now() - t0 });
        if (isLast && attempt < SAME_KEY_RETRY_DELAYS_MS.length) { await sleep(SAME_KEY_RETRY_DELAYS_MS[attempt]!); continue; }
        await o.store.setCooldown(st.id, new Date(now().getTime() + COOLDOWN_5XX_S * 1000), kind);
        break;
      }
      const latencyMs = Date.now() - t0;
      const s = res.status;
      if (s >= 200 && s < 300) {
        try {
          const value = o.validate(res.body);
          await o.store.log({ ...base, outcome: "success", httpStatus: s, latencyMs, ...res.usage });
          return value;
        } catch {
          await o.store.log({ ...base, outcome: "invalid_output", httpStatus: s, latencyMs, ...res.usage });
          throw new InvalidOutputError(); // input/model issue: do not rotate keys
        }
      }
      if (s === 429) {
        await o.store.log({ ...base, outcome: "rate_limited", httpStatus: s, latencyMs });
        await o.store.setCooldown(st.id, new Date(now().getTime() + retryAfterSeconds(res.headers) * 1000), "rate_limited");
        break;
      }
      if (s === 401 || s === 403) {
        await o.store.log({ ...base, outcome: "server_error", httpStatus: s, latencyMs });
        await o.store.setCooldown(st.id, new Date(now().getTime() + COOLDOWN_AUTH_S * 1000), "auth");
        break;
      }
      if (s === 400 || s === 422) {
        await o.store.log({ ...base, outcome: "bad_request", httpStatus: s, latencyMs });
        throw new AppError("bad_request", 502, "The AI could not process this input.");
      }
      // 5xx and anything else unexpected
      await o.store.log({ ...base, outcome: "server_error", httpStatus: s, latencyMs });
      if (isLast && attempt < SAME_KEY_RETRY_DELAYS_MS.length) { await sleep(SAME_KEY_RETRY_DELAYS_MS[attempt]!); continue; }
      await o.store.setCooldown(st.id, new Date(now().getTime() + COOLDOWN_5XX_S * 1000), `http_${s}`);
      break;
    }
  }
  throw Errors.aiBusy();
}
