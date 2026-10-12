// Cloudflare R2 (S3-compatible) access: presigning (SigV4 query auth) and server-side operations. Private bucket only.
import { AwsClient } from "aws4fetch";

export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; endpoint?: string };
export type PresignedPut = { url: string; method: "PUT"; headers: Record<string, string>; expires_at: string };

const encKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export class R2 {
  private aws: AwsClient;
  readonly bucket: string;
  private base: string;
  constructor(cfg: R2Config, private fetchFn: typeof fetch = fetch) {
    this.aws = new AwsClient({ accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey, service: "s3", region: "auto", retries: 3, initRetryMs: 100 });
    this.bucket = cfg.bucket;
    this.base = (cfg.endpoint ?? `https://${cfg.accountId}.r2.cloudflarestorage.com`).replace(/\/$/, "");
  }
  private objectUrl(key: string) { return `${this.base}/${this.bucket}/${encKey(key)}`; }

  /** Presigned PUT bound to Content-Type and (when given) Content-Length; both are signed headers. */
  async presignPut(key: string, o: { contentType: string; contentLength?: number; expiresS: number }): Promise<PresignedPut> {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(o.expiresS));
    // Content-Length is signed only when the size is known up front (PDF, audio). Slide JPEGs are rendered after the
    // URL is issued, so their size is enforced afterwards by a HEAD check in deck-process.
    const headers: Record<string, string> = { "Content-Type": o.contentType };
    if (o.contentLength !== undefined) headers["Content-Length"] = String(o.contentLength);
    const signed = await this.aws.sign(url.toString(), { method: "PUT", headers, aws: { signQuery: true, allHeaders: true } });
    return { url: signed.url, method: "PUT", headers, expires_at: new Date(Date.now() + o.expiresS * 1000).toISOString() };
  }

  async presignGet(key: string, expiresS: number): Promise<{ url: string; expires_at: string }> {
    const url = new URL(this.objectUrl(key));
    url.searchParams.set("X-Amz-Expires", String(expiresS));
    const signed = await this.aws.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return { url: signed.url, expires_at: new Date(Date.now() + expiresS * 1000).toISOString() };
  }

  async head(key: string): Promise<{ size: number; contentType: string | null } | null> {
    const res = await this.aws.fetch(this.objectUrl(key), { method: "HEAD" });
    if (res.status === 404) return null;
    if (!res.ok) throw new R2Error("head", res.status);
    return { size: Number(res.headers.get("content-length") ?? 0), contentType: res.headers.get("content-type") };
  }

  /** Read bytes [start, end] inclusive (HTTP Range). */
  async getRange(key: string, start: number, end: number): Promise<Uint8Array> {
    const res = await this.aws.fetch(this.objectUrl(key), { headers: { Range: `bytes=${start}-${end}` } });
    if (!res.ok) throw new R2Error("get", res.status);
    return new Uint8Array(await res.arrayBuffer());
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await this.aws.fetch(this.objectUrl(key));
    if (!res.ok) throw new R2Error("get", res.status);
    return new Uint8Array(await res.arrayBuffer());
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const res = await this.aws.fetch(this.objectUrl(key), { method: "PUT", body: body as unknown as BodyInit, headers: { "Content-Type": contentType } });
    if (!res.ok) throw new R2Error("put", res.status);
  }

  /** Idempotent: 404 counts as deleted. Throws on any other failure. */
  async delete(key: string): Promise<void> {
    const res = await this.aws.fetch(this.objectUrl(key), { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new R2Error("delete", res.status);
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const u = new URL(`${this.base}/${this.bucket}`);
      u.searchParams.set("list-type", "2");
      u.searchParams.set("prefix", prefix);
      if (token) u.searchParams.set("continuation-token", token);
      const res = await this.aws.fetch(u.toString());
      if (!res.ok) throw new R2Error("list", res.status);
      const xml = await res.text();
      for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(decodeXml(m[1]!));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1] : undefined;
      if (token) token = decodeXml(token);
    } while (token);
    return keys;
  }

  /** Delete everything under a prefix; returns the number of objects removed. Throws if any delete fails. */
  async deletePrefix(prefix: string): Promise<number> {
    const keys = await this.list(prefix);
    for (const k of keys) await this.delete(k);
    return keys.length;
  }
}

export class R2Error extends Error {
  constructor(public op: string, public status: number) { super(`r2_${op}_${status}`); }
}

const decodeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// ---- server-built object keys (§9.2). IDs must be DB-verified UUIDs; never client-supplied. ----
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(s: string): string { if (!UUID.test(s)) throw new Error("bad_id"); return s.toLowerCase(); }
function idx(n: number): number { if (!Number.isInteger(n) || n < 0 || n > 9) throw new Error("bad_index"); return n; }
export const keys = {
  userPrefix: (user: string) => `users/${id(user)}/`,
  deckPdf: (user: string, deck: string) => `users/${id(user)}/decks/${id(deck)}/source.pdf`,
  slideImage: (user: string, deck: string, i: number) => `users/${id(user)}/decks/${id(deck)}/slides/${idx(i)}.jpg`,
  audioClip: (user: string, session: string, i: number) => `users/${id(user)}/sessions/${id(session)}/audio/${idx(i)}.wav`,
};
