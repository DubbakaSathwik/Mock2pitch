// Placeholder: Phase 3 exchanges the OAuth code for a session here. In Phase 2 (mock mode) nothing signs in through this URL.
import { NextResponse } from "next/server";

export function GET(req: Request) {
  return NextResponse.redirect(new URL("/sign-in?error=oauth_not_configured", req.url));
}
