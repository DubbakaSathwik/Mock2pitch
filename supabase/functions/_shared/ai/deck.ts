// Reads a deck with Gemini: ONE request carries every slide image plus the student's details, so the model can write for the audience and
// share the time limit across the whole deck. Only when a call returns unusable output is the group split in halves (down to single slides),
// so one bad answer never costs more than the slides it covered. Availability errors (overload, rate limit, retired model) are NOT split:
// they fail over to the fallback model inside `callGroup` and otherwise propagate (AI_BUSY / model_unavailable).
import type { Deps } from "../deps.ts";
import { keysFor, modelFor } from "../env.ts";
import { chatText, chatTransport, GEMINI_CHAT_URL, parseJsonLoose, type ChatMessage } from "../nvidia/chat.ts";
import { routeCall, type RouterStore } from "../nvidia/router.ts";
import { BLANK_SLIDE, deckReadingOut, type DeckSlideOut } from "../schemas.ts";
import { DECK_READING_SYSTEM, buildDeckReadingUser, type DeckPromptDetails } from "../prompts/deck-reading.ts";
import { toBase64 } from "./base64.ts";

/** Room for the answer plus hidden "thinking" tokens: ten slides of key points and scripts are several thousand tokens. */
const DECK_MAX_TOKENS = 16384;
/** Gemini accepts up to ~20 MB of inline data per request; stay well under it (base64 adds a third). */
export const MAX_GROUP_BYTES = 10 * 1024 * 1024;
export const DEFAULT_TOTAL_MINUTES = 5;

export type SlideImage = { index: number; jpeg: Uint8Array };
export type ReadSlide = { title: string; slide_text: string; key_points: string[]; script: string; weight: number };

/** Timeout grows with the number of images: ~30 s for one slide, ~80 s for ten (a healthy Flash answer is a few seconds per slide). */
export const timeoutForSlides = (count: number) => Math.min(80_000, Math.max(30_000, 20_000 + 6_000 * count));

/** Split `images` (in order) into consecutive groups whose total size stays under `maxBytes`; normally a single group. */
export function groupBySize(images: SlideImage[], maxBytes = MAX_GROUP_BYTES): SlideImage[][] {
  const groups: SlideImage[][] = [];
  let cur: SlideImage[] = []; let bytes = 0;
  for (const im of images) {
    if (cur.length && bytes + im.jpeg.length > maxBytes) { groups.push(cur); cur = []; bytes = 0; }
    cur.push(im); bytes += im.jpeg.length;
  }
  if (cur.length) groups.push(cur);
  return groups;
}

/** Seconds from the model -> time_weight 1..100 = this slide's share of the time limit (weights are proportions, see suggestedSeconds). */
export function secondsToWeight(seconds: number | null, totalSeconds: number, fallback: number): number {
  const s = seconds ?? fallback;
  return Math.min(100, Math.max(1, Math.round((100 * s) / Math.max(1, totalSeconds))));
}

const codeOf = (e: unknown) => (e as { code?: string })?.code;

async function callGroup(deps: Deps, store: RouterStore, group: SlideImage[], details: DeckPromptDetails, total: number, ctx: { userId: string; deckId: string }): Promise<Map<number, DeckSlideOut>> {
  const from = group[0]!.index + 1, to = group[group.length - 1]!.index + 1;
  const parts: Array<Record<string, unknown>> = [{ type: "text", text: buildDeckReadingUser({ details, from, to, total }) }];
  for (const im of group) {
    parts.push({ type: "text", text: `Slide ${im.index + 1}:` });
    parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${toBase64(im.jpeg)}` } });
  }
  const messages: ChatMessage[] = [{ role: "system", content: DECK_READING_SYSTEM }, { role: "user", content: parts }];
  const call = (model: string) => routeCall({
    purpose: "slide_reading", model, keys: keysFor(deps.env, "slide_reading"), store,
    transport: chatTransport(model, messages, { maxTokens: DECK_MAX_TOKENS, fetchFn: deps.fetchFn, url: GEMINI_CHAT_URL }),
    timeoutMs: timeoutForSlides(group.length), rpmSoftLimit: deps.env.GEMINI_KEY_RPM_SOFT_LIMIT, ctx, cooldownOnTransient: false,
    validate: (body) => deckReadingOut.parse(parseJsonLoose(chatText(body))),
  });
  const primary = modelFor(deps.env, "slide_reading");
  const fallback = deps.env.GEMINI_SLIDE_FALLBACK_MODEL;
  let out;
  try { out = await call(primary); }
  catch (e) {
    // The fallback model covers a retired primary (404/410) and an overloaded one (503 / timeouts / 429 on every key).
    if ((codeOf(e) === "model_unavailable" || codeOf(e) === "AI_BUSY") && fallback && fallback !== primary) out = await call(fallback);
    else throw e;
  }
  const wanted = new Set(group.map((g) => g.index + 1));
  const byNo = new Map<number, DeckSlideOut>();
  for (const s of out.slides) if (wanted.has(s.slide_no) && !byNo.has(s.slide_no)) byNo.set(s.slide_no - 1, s);
  return byNo;
}

/**
 * Reads `images` (ascending `index`, 0-based) and returns one ReadSlide per image. `total` is the number of slides in the whole deck.
 * Slides the model skipped or garbled are retried in smaller groups; a single slide that still fails becomes a generic row.
 */
export async function readSlides(deps: Deps, store: RouterStore, images: SlideImage[], details: DeckPromptDetails, total: number, ctx: { userId: string; deckId: string }): Promise<Map<number, ReadSlide>> {
  const totalSeconds = Math.round(details.total_minutes * 60);
  const fallbackSeconds = Math.max(5, Math.round(totalSeconds / Math.max(1, total)));
  const result = new Map<number, ReadSlide>();
  const accept = (index: number, s: DeckSlideOut) => result.set(index, {
    title: s.title, slide_text: s.slide_text, key_points: s.key_points, script: s.script, weight: secondsToWeight(s.seconds, totalSeconds, fallbackSeconds),
  });
  const generic = (index: number) => result.set(index, { title: "", slide_text: "", key_points: BLANK_SLIDE.key_points, script: "", weight: secondsToWeight(null, totalSeconds, Math.min(15, fallbackSeconds)) });

  const readGroup = async (group: SlideImage[], retried = false): Promise<void> => {
    let got: Map<number, DeckSlideOut>;
    try { got = await callGroup(deps, store, group, details, total, ctx); }
    catch (e) {
      const c = codeOf(e);
      if (c !== "invalid_output" && c !== "bad_request") throw e; // overload / rate limit / retired model: not the image's fault, do not split
      if (group.length > 1) { const mid = Math.ceil(group.length / 2); await readGroup(group.slice(0, mid)); await readGroup(group.slice(mid)); return; }
      if (c === "invalid_output" && !retried) return readGroup(group, true); // one more try for a single slide, then a generic row
      generic(group[0]!.index); return;
    }
    const missing: SlideImage[] = [];
    for (const im of group) { const s = got.get(im.index); if (s) accept(im.index, s); else missing.push(im); }
    if (missing.length === group.length) { // a parseable answer that covers none of the slides is as good as invalid output
      if (group.length > 1) { const mid = Math.ceil(group.length / 2); await readGroup(group.slice(0, mid)); await readGroup(group.slice(mid)); }
      else if (!retried) await readGroup(group, true);
      else generic(group[0]!.index);
    } else if (missing.length) await readGroup(missing);
  };
  for (const g of groupBySize(images)) await readGroup(g);
  return result;
}
