// OpenAI-compatible NVIDIA chat transport (slide reading + report generation).
import { TransportError, type Transport } from "./router.ts";

export const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | Array<Record<string, unknown>> };

export function chatTransport(model: string, messages: ChatMessage[], opts: { maxTokens?: number; temperature?: number; json?: boolean; url?: string; fetchFn?: typeof fetch } = {}): Transport {
  const f = opts.fetchFn ?? fetch;
  return async ({ key, timeoutMs }) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await f(opts.url ?? NVIDIA_CHAT_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          model, messages, max_tokens: opts.maxTokens ?? 2048, temperature: opts.temperature ?? 0.2, stream: false,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: ctl.signal,
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      let body: unknown = null;
      try { body = await res.json(); } catch { body = null; }
      const u = (body as any)?.usage;
      return { status: res.status, headers, body, usage: u ? { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens } : undefined };
    } catch (e) {
      throw new TransportError((e as Error)?.name === "AbortError" ? "timeout" : "network");
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Extract assistant text from a chat completion body. */
export function chatText(body: unknown): string {
  const t = (body as any)?.choices?.[0]?.message?.content;
  if (typeof t !== "string") throw new Error("no_content");
  return t;
}

/** Parse JSON from model text, tolerating ```json fences and leading/trailing prose. */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) { try { return JSON.parse(fence[1]); } catch { /* fall through */ } }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("no_json");
}
