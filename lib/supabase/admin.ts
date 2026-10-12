import "server-only";
import { createClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "../env";

/** Service-role client. Server only; use after authorising the caller. Never import from client components. */
export function createAdminSupabase() {
  return createClient(clientEnv().NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
