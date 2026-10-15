// Signs a test user in without Google (password grant; production sign-up stays Google-only through the Auth hook) and installs the
// resulting session in a Playwright context as the exact cookies @supabase/ssr would have written.
import { createServerClient } from "@supabase/ssr";
import type { Browser, BrowserContext } from "@playwright/test";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export type ItUser = "NEW" | "A" | "B" | "DEL" | "ADMIN";

export const creds = (u: ItUser) => {
  const email = process.env[`IT_USER_${u}_EMAIL`], password = process.env[`IT_USER_${u}_PASSWORD`];
  if (!email || !password) throw new Error(`IT_USER_${u}_EMAIL / _PASSWORD are not set (run scripts/integration/provision-test-users.mjs)`);
  return { email, password };
};

type Cookie = { name: string; value: string; options?: Record<string, unknown> };

export async function passwordSession(u: ItUser): Promise<{ session: Session; cookies: Cookie[]; client: SupabaseClient }> {
  const captured: Cookie[] = [];
  const ssr = createServerClient(SUPABASE_URL, ANON_KEY, { cookies: { getAll: () => [], setAll: (l) => { captured.push(...l); } } });
  const { data, error } = await ssr.auth.signInWithPassword(creds(u));
  if (error || !data.session) throw new Error(`password sign-in failed for ${u}: ${error?.message}`);
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
  return { session: data.session, cookies: captured, client };
}

export async function signedInContext(browser: Browser, u: ItUser, baseURL: string, opts: Parameters<Browser["newContext"]>[0] = {}): Promise<{ ctx: BrowserContext; client: SupabaseClient; userId: string }> {
  const { session, cookies, client } = await passwordSession(u);
  // Pre-onboarded users re-accept a newer policy version (spec 09 publishes one); NEW is left alone: it exercises the first-time Terms screen.
  if (u !== "NEW") {
    const has = await client.rpc("has_accepted_latest_policy");
    if (has.data === false) {
      const { data: latest } = await client.from("policy_versions").select("id").order("published_at", { ascending: false }).limit(1).single();
      await client.rpc("accept_policy", { p_version_id: latest!.id });
    }
  }
  const ctx = await browser.newContext({ baseURL, permissions: ["microphone"], ...opts });
  const host = new URL(baseURL);
  await ctx.addCookies(cookies.map((c) => ({ name: c.name, value: c.value, domain: host.hostname, path: "/", httpOnly: false, secure: host.protocol === "https:", sameSite: "Lax" as const, expires: Math.floor(Date.now() / 1000) + 400 * 86400 })));
  return { ctx, client, userId: session.user.id };
}
