// A fake S3/R2 server that independently verifies AWS SigV4 (header and presigned-query forms).
import http from "node:http";
import crypto from "node:crypto";

const hmac = (k: crypto.BinaryLike | crypto.KeyObject, d: string) => crypto.createHmac("sha256", k).update(d).digest();
const sha = (d: string | Buffer) => crypto.createHash("sha256").update(d).digest("hex");
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export type FakeS3 = Awaited<ReturnType<typeof startFakeS3>>;

export async function startFakeS3(o: { accessKeyId: string; secretAccessKey: string; bucket: string; now?: () => number; failDelete?: (key: string) => boolean; corsOrigins?: string[] }) {
  const store = new Map<string, { body: Buffer; contentType: string }>();
  const requests: { method: string; path: string; ok: boolean; reason?: string }[] = [];
  const now = o.now ?? (() => Date.now());

  function verify(req: http.IncomingMessage, url: URL): string | null {
    const q = url.searchParams;
    const presigned = q.has("X-Amz-Signature");
    let credential: string, signedHeaders: string, signature: string, amzDate: string, payloadHash: string;
    if (presigned) {
      credential = q.get("X-Amz-Credential")!; signedHeaders = q.get("X-Amz-SignedHeaders")!; signature = q.get("X-Amz-Signature")!;
      amzDate = q.get("X-Amz-Date")!; payloadHash = "UNSIGNED-PAYLOAD";
      const t = Date.parse(amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z"));
      const exp = Number(q.get("X-Amz-Expires"));
      if (!(exp > 0 && exp <= 604800)) return "bad_expires";
      if (now() > t + exp * 1000) return "expired";
      if (now() < t - 5 * 60_000) return "future";
    } else {
      const auth = req.headers["authorization"];
      if (!auth) return "no_auth";
      const m = /^AWS4-HMAC-SHA256 Credential=([^,]+), SignedHeaders=([^,]+), Signature=([0-9a-f]+)$/.exec(String(auth));
      if (!m) return "bad_auth";
      credential = m[1]!; signedHeaders = m[2]!; signature = m[3]!;
      amzDate = String(req.headers["x-amz-date"]); payloadHash = String(req.headers["x-amz-content-sha256"] ?? "UNSIGNED-PAYLOAD");
    }
    const [akid, date, region, service, term] = credential.split("/") as [string, string, string, string, string];
    if (akid !== o.accessKeyId) return "bad_key";
    if (service !== "s3" || term !== "aws4_request") return "bad_scope";
    const names = signedHeaders.split(";");
    const canonHeaders = names.map((n) => {
      let v = n === "host" ? String(req.headers["host"]) : req.headers[n];
      if (v === undefined) return `${n}:\n`;
      v = (Array.isArray(v) ? v.join(",") : String(v)).trim().replace(/\s+/g, " ");
      return `${n}:${v}\n`;
    }).join("");
    const qs = [...q.entries()].filter(([k]) => k !== "X-Amz-Signature").map(([k, v]) => [rfc3986(k), rfc3986(v)] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("&");
    const canonical = [req.method, url.pathname, qs, canonHeaders, signedHeaders, payloadHash].join("\n");
    const sts = ["AWS4-HMAC-SHA256", amzDate, `${date}/${region}/${service}/${term}`, sha(canonical)].join("\n");
    const kSigning = hmac(hmac(hmac(hmac("AWS4" + o.secretAccessKey, date), region), service), term);
    const expected = crypto.createHmac("sha256", kSigning).update(sts).digest("hex");
    if (expected !== signature) return "signature_mismatch";
    if (presigned && req.method === "PUT") {
      // The point of signing these: a different type/length makes the signature check fail above; assert they were signed.
      if (!names.includes("content-type")) return "put_not_bound_to_type";
    }
    return null;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks);
    const log = (ok: boolean, reason?: string) => requests.push({ method: req.method!, path: url.pathname, ok, reason });
    const deny = (reason: string) => { log(false, reason); res.writeHead(403, { "Content-Type": "application/xml" }); res.end(`<Error><Code>${reason}</Code></Error>`); };
    if (req.method === "OPTIONS") { // CORS preflight carries no signature
      const origin = String(req.headers["origin"] ?? "");
      const allowed = !!origin && (o.corsOrigins ?? []).includes(origin);
      log(allowed);
      res.writeHead(allowed ? 200 : 403, allowed ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "PUT, GET, HEAD" } : {});
      return void res.end();
    }
    const bad = verify(req, url);
    if (bad) return deny(bad);
    const prefix = `/${o.bucket}`;
    if (!url.pathname.startsWith(prefix)) return deny("no_bucket");
    const key = decodeURIComponent(url.pathname.slice(prefix.length + 1));
    if (!key && req.method === "GET" && url.searchParams.get("list-type") === "2") {
      const p = url.searchParams.get("prefix") ?? "";
      const all = [...store.keys()].filter((k) => k.startsWith(p)).sort();
      const start = Number(url.searchParams.get("continuation-token") ?? 0);
      const page = all.slice(start, start + 2); // tiny pages to exercise pagination
      const more = start + 2 < all.length;
      log(true);
      res.writeHead(200, { "Content-Type": "application/xml" });
      return void res.end(`<ListBucketResult><IsTruncated>${more}</IsTruncated>${more ? `<NextContinuationToken>${start + 2}</NextContinuationToken>` : ""}${page.map((k) => `<Contents><Key>${k.replace(/&/g, "&amp;")}</Key></Contents>`).join("")}</ListBucketResult>`);
    }
    log(true);
    if (req.method === "PUT") {
      const ct = String(req.headers["content-type"] ?? "application/octet-stream");
      store.set(key, { body, contentType: ct });
      res.writeHead(200, { ETag: '"x"' }); return void res.end();
    }
    const obj = store.get(key);
    if (req.method === "HEAD") {
      if (!obj) { res.writeHead(404); return void res.end(); }
      res.writeHead(200, { "Content-Length": obj.body.length, "Content-Type": obj.contentType }); return void res.end();
    }
    if (req.method === "GET") {
      if (!obj) { res.writeHead(404); return void res.end(); }
      const range = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers["range"] ?? ""));
      if (range) { const part = obj.body.subarray(Number(range[1]), Number(range[2]) + 1); res.writeHead(206, { "Content-Length": part.length, "Content-Type": obj.contentType }); return void res.end(part); }
      res.writeHead(200, { "Content-Length": obj.body.length, "Content-Type": obj.contentType }); return void res.end(obj.body);
    }
    if (req.method === "DELETE") {
      if (o.failDelete?.(key)) { res.writeHead(500); return void res.end(); }
      store.delete(key); res.writeHead(204); return void res.end();
    }
    res.writeHead(405); res.end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as any).port as number;
  return {
    endpoint: `http://127.0.0.1:${port}`, store, requests,
    keys: () => [...store.keys()].sort(),
    stop: () => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }),
  };
}
