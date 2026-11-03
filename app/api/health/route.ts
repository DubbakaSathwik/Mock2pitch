// Public liveness probe for the web app (uptime monitors, Netlify/GitHub checks). Reports only whether the build is wired to a backend;
// the backend's own probe is the `health` Edge Function (`<supabase-url>/functions/v1/health`).
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE === "supabase" ? "supabase" : "mock";
  const backendConfigured = mode === "mock" || (!!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return new Response(JSON.stringify({ ok: backendConfigured, mode, backend_configured: backendConfigured }), {
    status: backendConfigured ? 200 : 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
