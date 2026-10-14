import type { Deps } from "../deps.ts";
import { keysFor, modelFor } from "../env.ts";
import { chatText, chatTransport, parseJsonLoose, type ChatMessage } from "../nvidia/chat.ts";
import { routeCall, type RouterStore } from "../nvidia/router.ts";
import { slideReadingOut, type SlideReadingOut } from "../schemas.ts";
import { SLIDE_READING_SYSTEM, SLIDE_READING_USER } from "../prompts/slide-reading.ts";
import { TIMEOUT_SLIDE_MS } from "../constants.ts";
import { toBase64 } from "./base64.ts";

/** One vision call for one slide image. Throws AppError AI_BUSY / bad_request / invalid_output. */
export function readSlide(deps: Deps, store: RouterStore, jpeg: Uint8Array, ctx: { userId: string; deckId: string }): Promise<SlideReadingOut> {
  const model = modelFor(deps.env, "slide_reading");
  const messages: ChatMessage[] = [
    { role: "system", content: SLIDE_READING_SYSTEM },
    { role: "user", content: [{ type: "text", text: SLIDE_READING_USER }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(jpeg)}` } }] },
  ];
  return routeCall({
    purpose: "slide_reading", model, keys: keysFor(deps.env, "slide_reading"), store,
    transport: chatTransport(model, messages, { maxTokens: 2048, fetchFn: deps.fetchFn }),
    timeoutMs: TIMEOUT_SLIDE_MS, rpmSoftLimit: deps.env.NVIDIA_KEY_RPM_SOFT_LIMIT, ctx,
    validate: (body) => slideReadingOut.parse(parseJsonLoose(chatText(body))),
  });
}
