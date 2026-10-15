import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { clientEnv } from "../env.public";

/** Cookie-bound server client for Route Handlers / Server Components. Uses the anon key only: never the service role. */
export async function createServerSupabase() {
  const e = clientEnv();
  const store = await cookies();
  return createServerClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a Server Component: the proxy refreshes the cookies */ }
      },
    },
  });
}
