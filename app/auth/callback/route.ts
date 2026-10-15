// Google OAuth landing (PKCE): exchanges the code for a session (cookies), then redirects to a sanitised `next`.
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { dataMode } from "@/lib/env.public";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/sign-in?error=${reason}`, url.origin));
  if (dataMode() !== "supabase") return fail("oauth_not_configured");
  if (url.searchParams.get("error")) return fail("oauth"); // user denied consent, provider error, ...
  const code = url.searchParams.get("code");
  if (!code) return fail("oauth");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("oauth");
  // The role comes from the profiles row (server data), never from the URL or client claims.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("oauth");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const next = safeNext(url.searchParams.get("next"), profile?.role === "admin" ? "/admin" : "/dashboard");
  const dest = profile?.role === "admin" && !next.startsWith("/admin") ? "/admin" : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
