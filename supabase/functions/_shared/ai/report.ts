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
  const model = modelFor(deps.env, "report_generation");
  const base: ChatMessage[] = [
    { role: "system", content: REPORT_SYSTEM },
    { role: "user", content: JSON.stringify({ slides }) },
  ];
  const attempt = (messages: ChatMessage[]) => routeCall({
    purpose: "report_generation", model, keys: keysFor(deps.env, "report_generation"), store,
    transport: chatTransport(model, messages, { maxTokens: 3072, fetchFn: deps.fetchFn }),
    timeoutMs: TIMEOUT_REPORT_MS, rpmSoftLimit: deps.env.NVIDIA_KEY_RPM_SOFT_LIMIT, ctx,
    validate: (body) => reportOut.parse(parseJsonLoose(chatText(body))),
  });
  try {
    return await attempt(base);
  } catch (e) {
    if ((e as { code?: string }).code !== "invalid_output") throw e;
    return await attempt([...base, { role: "user", content: "Your previous reply was not valid JSON for the required schema. Reply again with ONLY the JSON object, exactly matching the schema." }]);
  }
}
