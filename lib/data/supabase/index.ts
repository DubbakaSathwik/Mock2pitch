import { createBrowserSupabase } from "@/lib/supabase/browser";
import { clientEnv } from "@/lib/env.public";
import type { DataPort } from "../types";
import { createSupabaseData } from "./adapter";

/** The production adapter: browser Supabase client (cookie session) + Edge Functions at `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1`. */
export function getSupabaseData(): DataPort {
  const e = clientEnv();
  return createSupabaseData({
    supa: createBrowserSupabase(),
    functionsUrl: `${e.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/functions/v1`,
    anonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    appUrl: e.NEXT_PUBLIC_APP_URL,
  });
}
