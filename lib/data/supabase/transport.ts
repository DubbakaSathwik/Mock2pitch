// Authenticated transport for the Supabase adapter: fresh tokens, one refresh-and-retry on 401, Edge Function envelope handling.
import type { Supa } from "@/lib/supabase/browser";
import type { Database } from "@/types/database";
import { AppError } from "../errors";
import { fromAuth, fromFunctionResponse, fromPostgrest } from "./errors";

export type Transport = {
  supa: Supa;
  /** A valid access token, refreshed when it has < 60 s left (or unconditionally with `force`). */
  token(force?: boolean): Promise<string>;
  fn<T>(name: string, body: Record<string, unknown>): Promise<T>;
  rpc<T>(name: keyof Database["public"]["Functions"], args?: Record<string, unknown>): Promise<T>;
  /** Runs a PostgREST read/write; throws a normalised AppError, retrying once after a token refresh on an auth failure. */
   
  db(run: () => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>): Promise<any>;
};

export type TransportOptions = { supa: Supa; functionsUrl: string; anonKey: string; fetch?: typeof fetch; now?: () => number };

export function createTransport(o: TransportOptions): Transport {
  const { supa } = o;
  const doFetch = o.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = o.now ?? Date.now;

  async function token(force = false): Promise<string> {
    if (force) {
      const { data, error } = await supa.auth.refreshSession();
      if (error || !data.session) throw fromAuth(error);
      return data.session.access_token;
    }
    const { data, error } = await supa.auth.getSession();
    if (error || !data.session) throw error ? fromAuth(error) : new AppError("not_authenticated");
    const exp = data.session.expires_at ?? 0;
    if (exp - now() / 1000 < 60) return token(true);
    return data.session.access_token;
  }

  async function withRetry<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); }
    catch (e) {
      if (e instanceof AppError && e.code === "not_authenticated") { await token(true); return run(); }
      throw e;
    }
  }

  async function fn<T>(name: string, body: Record<string, unknown>): Promise<T> {
    return withRetry(async () => {
      const jwt = await token();
      let res: Response;
      try {
        res = await doFetch(`${o.functionsUrl}/${name}`, { method: "POST", headers: { Authorization: `Bearer ${jwt}`, apikey: o.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch { throw new AppError("network_error"); }
      let json: unknown = null;
      try { json = await res.json(); } catch { /* non-JSON error page */ }
      const env = json as { ok?: boolean; data?: unknown } | null;
      if (res.ok && env && env.ok === true) return env.data as T;
      throw fromFunctionResponse(res.status, json);
    });
  }

  async function rpc<T>(name: keyof Database["public"]["Functions"], args?: Record<string, unknown>): Promise<T> {
    return withRetry(async () => {
      const { data, error } = await (supa.rpc as (n: string, a?: unknown) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>)(name, args ?? {});
      if (error) throw fromPostgrest(error);
      return data as T;
    });
  }

   
  async function db(run: () => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>): Promise<any> {
    return withRetry(async () => {
      const { data, error } = await run();
      if (error) throw fromPostgrest(error);
      return data;
    });
  }

  return { supa, token, fn, rpc, db };
}
