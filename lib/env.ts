// Zod-validated environment for the Next.js app. Public values are readable in the browser; server values never are.
import { z } from "zod";
import { parse } from "./env.public";

export { clientEnv, dataMode } from "./env.public";

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INTERNAL_TRANSCRIBE_SECRET: z.string().min(16),
});

/** Server-only. Throws if called from the browser bundle. */
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() must not be called in the browser");
  return parse(serverSchema, { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, INTERNAL_TRANSCRIBE_SECRET: process.env.INTERNAL_TRANSCRIBE_SECRET }, "server");
}

