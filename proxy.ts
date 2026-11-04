// Next.js 16 request proxy (formerly middleware). Two jobs:
//  1. Content-Security-Policy with a per-request script nonce (see lib/csp.ts).
//  2. In `supabase` data mode, keeps the Supabase auth cookies fresh on navigation.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildCsp, newNonce } from "@/lib/csp";

export async function proxy(request: NextRequest) {
  const nonce = newNonce();
  const csp = buildCsp({ nonce, isDev: process.env.NODE_ENV === "development", supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  // Next.js reads the nonce from the CSP header of the REQUEST while rendering and stamps it on its own scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = next();
  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase" && url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          requestHeaders.set("cookie", request.headers.get("cookie") ?? ""); // downstream server code must see the refreshed session
          response = next();
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // Validates the access token (refreshing it when expired) and rewrites the cookies. Role/redirect decisions stay in the client guards,
    // which read the profile row under RLS; the proxy never trusts claims for authorisation.
    await supabase.auth.getClaims();
    response.headers.set("Cache-Control", "private, no-store");
  }
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|fonts/|mock/|landing/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|woff2)$).*)"],
};
