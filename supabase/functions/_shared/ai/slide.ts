import type { Deps } from "../deps.ts";
import { keysFor, modelFor } from "../env.ts";
import { chatText, chatTransport, GEMINI_CHAT_URL, parseJsonLoose, type ChatMessage } from "../nvidia/chat.ts";
import { routeCall, type RouterStore } from "../nvidia/router.ts";
import { slideReadingOut, type SlideReadingOut } from "../schemas.ts";
import { SLIDE_READING_SYSTEM, SLIDE_READING_USER } from "../prompts/slide-reading.ts";
import { TIMEOUT_SLIDE_MS } from "../constants.ts";
import { toBase64 } from "./base64.ts";

/** Room for the answer plus any hidden "thinking" tokens Gemini 2.5+/3 models spend before it (they count against max_tokens). */
const SLIDE_MAX_TOKENS = 8192;

/**
 * One vision call for one slide image, served by Google Gemini (OpenAI-compatible endpoint).
 * Models are tried in order: GEMINI_SLIDE_MODEL, then the optional GEMINI_SLIDE_FALLBACK_MODEL. The fallback is used when the primary model is gone
 * (HTTP 404/410 -> `model_unavailable`) or overloaded on every key (503 / timeouts / 429 -> `AI_BUSY`). A bad image (`bad_request`) or an unusable
 * answer (`invalid_output`) is not a model-availability problem and is never retried on another model here.
 * Throws AppError AI_BUSY / bad_request / invalid_output / model_unavailable.
 */
export async function readSlide(deps: Deps, store: RouterStore, jpeg: Uint8Array, ctx: { userId: string; deckId: string }): Promise<SlideReadingOut> {
  const messages: ChatMessage[] = [
    { role: "system", content: SLIDE_READING_SYSTEM },
    { role: "user", content: [{ type: "text", text: SLIDE_READING_USER }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}` } }] },
  ];
  const call = (model: string) => routeCall({
    purpose: "slide_reading", model, keys: keysFor(deps.env, "slide_reading"), store,
    transport: chatTransport(model, messages, { maxTokens: SLIDE_MAX_TOKENS, fetchFn: deps.fetchFn, url: GEMINI_CHAT_URL }),
    timeoutMs: TIMEOUT_SLIDE_MS, rpmSoftLimit: deps.env.GEMINI_KEY_RPM_SOFT_LIMIT, ctx, cooldownOnTransient: false,
    validate: (body) => slideReadingOut.parse(parseJsonLoose(chatText(body))),
  });
  const primary = modelFor(deps.env, "slide_reading");
  const fallback = deps.env.GEMINI_SLIDE_FALLBACK_MODEL;
  try {
    return await call(primary);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if ((code === "model_unavailable" || code === "AI_BUSY") && fallback && fallback !== primary) return await call(fallback);
    throw e;
  }
}
