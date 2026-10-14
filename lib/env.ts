// Zod-validated environment for the Next.js app. Public values are readable in the browser; server values never are.
import { z } from "zod";

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INTERNAL_TRANSCRIBE_SECRET: z.string().min(16),
});

function parse<T extends z.ZodTypeAny>(schema: T, raw: Record<string, string | undefined>, label: string): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) {
    // Name the variables, never print their values.
    throw new Error(`Invalid ${label} environment: ${[...new Set(r.error.issues.map((i) => String(i.path[0])))].join(", ")}`);
  }
  return r.data;
}

/** Browser-safe. Each NEXT_PUBLIC_ variable must be referenced literally so Next.js can inline it. */
export function clientEnv() {
  return parse(clientSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  }, "client");
}

/** Server-only. Throws if called from the browser bundle. */
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() must not be called in the browser");
  return parse(serverSchema, { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, INTERNAL_TRANSCRIBE_SECRET: process.env.INTERNAL_TRANSCRIBE_SECRET }, "server");
}

// ---- Phase 2: data mode (which adapter the UI talks to) -------------------------------------------------------------
const publicFlagsSchema = z.object({
  NEXT_PUBLIC_DATA_MODE: z.enum(["mock", "supabase"]).default("mock"),
  NEXT_PUBLIC_ALLOW_MOCK_IN_PROD: z.enum(["1", "0"]).default("0"),
});

/**
 * `mock` (default in Phase 2) = in-memory adapter; `supabase` = real adapter (Phase 3).
 * A production build with `mock` fails fast unless NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1 (used only for a review deploy).
 */
export function dataMode(): "mock" | "supabase" {
  const f = parse(publicFlagsSchema, {
    NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE || undefined,
    NEXT_PUBLIC_ALLOW_MOCK_IN_PROD: process.env.NEXT_PUBLIC_ALLOW_MOCK_IN_PROD || undefined,
  }, "public flags");
  if (f.NEXT_PUBLIC_DATA_MODE === "mock" && process.env.NODE_ENV === "production" && f.NEXT_PUBLIC_ALLOW_MOCK_IN_PROD !== "1") {
    throw new Error("NEXT_PUBLIC_DATA_MODE=mock is not allowed in a production build (set NEXT_PUBLIC_ALLOW_MOCK_IN_PROD=1 for a review deploy only).");
  }
  return f.NEXT_PUBLIC_DATA_MODE;
}
