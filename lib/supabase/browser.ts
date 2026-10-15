import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clientEnv } from "../env.public";

export type Supa = SupabaseClient<Database>;
let client: Supa | null = null;

/**
 * Browser client (anon/publishable key; RLS applies). The session lives in cookies (@supabase/ssr) so the server-side proxy and route
 * handlers see the same session. One instance per tab. Auth is Google-only in production (see docs/phase-1/supabase.md).
 */
export function createBrowserSupabase(): Supa {
  if (client) return client;
  const e = clientEnv();
  client = createBrowserClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}

/** Tests inject a stub client (or null to reset). */
export function setBrowserSupabase(c: Supa | null) { client = c; }
