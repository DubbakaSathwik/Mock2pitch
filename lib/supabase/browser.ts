import { createClient } from "@supabase/supabase-js";
import { clientEnv } from "../env";

/** Browser client (anon key; RLS applies). Auth is Google-only (see docs/phase-1/supabase.md). */
export function createBrowserSupabase() {
  const e = clientEnv();
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
