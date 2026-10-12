// Edge Function environment (validated lazily so unit tests can import modules without secrets).
import { z } from "zod";
import { PURPOSES, SLOTS, type Purpose, type Slot } from "./constants.ts";

const opt = z.string().optional().transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));
const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INTERNAL_FUNCTION_SECRET: z.string().min(16),
  APP_ALLOWED_ORIGINS: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  NVIDIA_SLIDE_MODEL: z.string().min(1),
  NVIDIA_REPORT_MODEL: z.string().min(1),
  NVIDIA_ASR_FUNCTION_ID: z.string().min(1),
  NVIDIA_ASR_MODEL_LABEL: z.string().default("parakeet-tdt-0.6b-v2"),
  NVIDIA_KEY_RPM_SOFT_LIMIT: z.coerce.number().int().positive().default(35),
  NVIDIA_KEY_DEFAULT_CREDIT_LIMIT: z.coerce.number().int().positive().default(1000),
  NVIDIA_SLIDE_KEY_PRIMARY: opt, NVIDIA_SLIDE_KEY_FALLBACK_1: opt, NVIDIA_SLIDE_KEY_FALLBACK_2: opt,
  NVIDIA_ASR_KEY_PRIMARY: opt, NVIDIA_ASR_KEY_FALLBACK_1: opt, NVIDIA_ASR_KEY_FALLBACK_2: opt,
  NVIDIA_REPORT_KEY_PRIMARY: opt, NVIDIA_REPORT_KEY_FALLBACK_1: opt, NVIDIA_REPORT_KEY_FALLBACK_2: opt,
  INTERNAL_TRANSCRIBE_URL: opt, INTERNAL_TRANSCRIBE_SECRET: opt,
});
export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function getEnv(raw: Record<string, string | undefined> = Deno.env.toObject()): Env {
  if (cached) return cached;
  const r = schema.safeParse(raw);
  if (!r.success) {
    // Name the variables, never their values.
    const names = [...new Set(r.error.issues.map((i) => String(i.path[0])))].join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  cached = r.data;
  return cached;
}
export const allowedOrigins = (e: Env) => e.APP_ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);

export function keyEnvName(p: Purpose, s: Slot): string {
  const prefix = p === "slide_reading" ? "SLIDE" : p === "speech_to_text" ? "ASR" : "REPORT";
  return `NVIDIA_${prefix}_KEY_${s === "primary" ? "PRIMARY" : s.toUpperCase()}`;
}
export function modelFor(e: Env, p: Purpose): string {
  return p === "slide_reading" ? e.NVIDIA_SLIDE_MODEL : p === "report_generation" ? e.NVIDIA_REPORT_MODEL : e.NVIDIA_ASR_MODEL_LABEL;
}
export function keysFor(e: Env, p: Purpose): { slot: Slot; key: string }[] {
  const out: { slot: Slot; key: string }[] = [];
  for (const slot of SLOTS) {
    const v = (e as Record<string, unknown>)[keyEnvName(p, slot)];
    if (typeof v === "string" && v) out.push({ slot, key: v });
  }
  return out;
}
export { PURPOSES };
