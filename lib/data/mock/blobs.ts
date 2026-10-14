// In-memory "R2": validates presigned-PUT semantics the way real R2 does (Content-Type and body length are part of the signature)
// and keeps the bytes so later pipeline steps (and local playback) can use them. Nothing here ever leaves the browser tab.
import { AppError } from "../errors";
import type { PutOptions } from "@/lib/upload/put";

export type Expect = { type: string; size?: number };

export class BlobStore {
  private expectations = new Map<string, Expect>();
  private blobs = new Map<string, Blob>();
  private objectUrls = new Map<string, string>();
  /** Fail the next N PUTs with a network-style error (E2E: "upload failure + retry"). */
  failNextPuts = 0;
  stepDelayMs = 0;

  expect(path: string, e: Expect) { this.expectations.set(path, e); this.blobs.delete(path); const u = this.objectUrls.get(path); if (u) { URL.revokeObjectURL(u); this.objectUrls.delete(path); } }
  has(path: string) { return this.blobs.has(path); }
  get(path: string) { return this.blobs.get(path); }
  delete(path: string) { this.blobs.delete(path); this.expectations.delete(path); const u = this.objectUrls.get(path); if (u) { URL.revokeObjectURL(u); this.objectUrls.delete(path); } }
  deletePrefix(prefix: string) { for (const k of [...this.blobs.keys(), ...this.expectations.keys()]) if (k.startsWith(prefix)) this.delete(k); }
  clear() { for (const k of [...this.blobs.keys(), ...this.expectations.keys()]) this.delete(k); }
  objectUrl(path: string): string | null {
    const b = this.blobs.get(path);
    if (!b) return null;
    let u = this.objectUrls.get(path);
    if (!u) { u = URL.createObjectURL(b); this.objectUrls.set(path, u); }
    return u;
  }

  /** Transport for `mock://put/<path>` targets (registered with lib/upload/put.ts). */
  async put(target: { url: string; headers: Record<string, string> }, body: Blob, opts: PutOptions): Promise<void> {
    const path = target.url.replace(/^mock:\/\/put\//, "");
    if (opts.signal?.aborted) throw new AppError("network_error", "Cancelled.");
    if (this.failNextPuts > 0) { this.failNextPuts--; throw new AppError("upload_failed"); }
    const exp = this.expectations.get(path);
    if (!exp) throw new AppError("forbidden", "The upload URL is not valid or has expired.");
    const type = Object.entries(target.headers).find(([k]) => k.toLowerCase() === "content-type")?.[1] ?? "";
    if (type.toLowerCase() !== exp.type.toLowerCase()) throw new AppError("forbidden", "SignatureDoesNotMatch: Content-Type");
    if (exp.size !== undefined && body.size !== exp.size) throw new AppError("forbidden", "SignatureDoesNotMatch: Content-Length");
    for (const f of [0.25, 0.5, 0.75]) {
      if (this.stepDelayMs > 0) await new Promise((r) => setTimeout(r, this.stepDelayMs));
      if (opts.signal?.aborted) throw new AppError("network_error", "Cancelled.");
      opts.onProgress?.(Math.round(body.size * f), body.size);
    }
    this.blobs.set(path, body);
    opts.onProgress?.(body.size, body.size);
  }
}
