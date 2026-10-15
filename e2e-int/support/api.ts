// Direct calls to the Edge Functions / R2 with a user's JWT, bypassing every client-side check (server-side validation tests).
import fs from "node:fs";
import path from "node:path";
import { ANON_KEY, SUPABASE_URL, type ItUser, passwordSession } from "./session";

export const fixtureBytes = (name: string) => fs.readFileSync(path.resolve("tests/fixtures", name));

export type FnResult<T = Record<string, any>> = { status: number; ok: boolean; data?: T; error?: { code: string; message: string; [k: string]: unknown } };

export async function userApi(u: ItUser) {
  const { session, client } = await passwordSession(u);
  const fn = async <T = Record<string, any>>(name: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<FnResult<T>> => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, apikey: ANON_KEY, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
    let j: any = null; try { j = await res.json(); } catch { /* */ }
    return { status: res.status, ok: !!j?.ok, data: j?.data, error: j?.error ?? (j && !("ok" in j) ? { code: String(j.code ?? j.error ?? "gateway"), message: String(j.message ?? j.msg ?? "") } : undefined) };
  };
  return { fn, client, userId: session.user.id, token: session.access_token };
}

/** PUT bytes to a presigned URL exactly like the browser helper does (signed Content-Type only; fetch sets Content-Length). */
export async function putSigned(upload: { url: string; headers: Record<string, string> }, body: Buffer | Uint8Array, overrideContentType?: string) {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(upload.headers)) if (k.toLowerCase() !== "content-length") headers[k] = v;
  if (overrideContentType) headers["Content-Type"] = overrideContentType;
  const res = await fetch(upload.url, { method: "PUT", headers, body: new Uint8Array(body) });
  return { status: res.status, text: res.status >= 400 ? (await res.text()).slice(0, 200) : "" };
}
