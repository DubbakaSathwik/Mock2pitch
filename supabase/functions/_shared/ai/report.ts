import type { Deps } from "../deps.ts";
import { keysFor, modelFor } from "../env.ts";
import { chatText, chatTransport, parseJsonLoose, type ChatMessage } from "../nvidia/chat.ts";
import { routeCall, type RouterStore } from "../nvidia/router.ts";
import { reportOut, type ReportOut } from "../schemas.ts";
import { REPORT_SYSTEM } from "../prompts/report.ts";
import { TIMEOUT_REPORT_MS } from "../constants.ts";

export type ReportInputSlide = {
  slide_index: number; title: string; key_points: string[]; suggested_seconds: number; actual_seconds: number;
  wpm: number | null; filler_counts: { word: string; count: number }[]; recorded: boolean; transcript: string;
};

/** One report call, with exactly one repair retry when the model's output is invalid. */
export async function generateReport(deps: Deps, store: RouterStore, slides: ReportInputSlide[], ctx: { userId: string; sessionId: string }): Promise<ReportOut> {
  const primary = modelFor(deps.env, "report_generation");
  const fallback = deps.env.NVIDIA_REPORT_FALLBACK_MODEL;
  const base: ChatMessage[] = [
    { role: "system", content: REPORT_SYSTEM },
    { role: "user", content: JSON.stringify({ slides }) },
  ];
  const call = (model: string, messages: ChatMessage[]) => routeCall({
    purpose: "report_generation", model, keys: keysFor(deps.env, "report_generation"), store,
    transport: chatTransport(model, messages, { maxTokens: 6144, fetchFn: deps.fetchFn }),
    // Overload is per model: a slow or busy primary must not lock the key out for the fallback model that is about to be tried.
    timeoutMs: TIMEOUT_REPORT_MS, rpmSoftLimit: deps.env.NVIDIA_KEY_RPM_SOFT_LIMIT, ctx, cooldownOnTransient: !fallback,
    validate: (body) => reportOut.parse(parseJsonLoose(chatText(body))),
  });
  // Primary model first; on "gone" (404/410) or "overloaded on every key" the optional fallback model gets the same request.
  const attempt = async (messages: ChatMessage[]) => {
    try { return await call(primary, messages); }
    catch (e) {
      const code = (e as { code?: string }).code;
      if ((code === "model_unavailable" || code === "AI_BUSY") && fallback && fallback !== primary) return await call(fallback, messages);
      throw e;
    }
  };
  try {
    return await attempt(base);
  } catch (e) {
    if ((e as { code?: string }).code !== "invalid_output") throw e;
    // Unusable or cut-off answer: a different model is more likely to fix it than the same one asked again.
    if (fallback && fallback !== primary) {
      try { return await call(fallback, base); }
      catch (e2) { if ((e2 as { code?: string }).code !== "invalid_output") throw e2; }
    }
    return await attempt([...base, { role: "user", content: "Your previous reply was not valid JSON for the required schema. Reply again with ONLY the JSON object, exactly matching the schema. Do not think out loud; keep it short." }]);
  }
}
