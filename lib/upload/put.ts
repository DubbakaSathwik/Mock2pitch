// Upload to a presigned URL with progress + abort. Never sets Content-Length (the browser derives it from the body, which must
// equal the size that was signed). In mock mode the target is a `mock://` URL handled by a registered transport.
import { AppError } from "@/lib/data/errors";
import type { SignedUpload } from "@/lib/data/types";

export type PutOptions = { onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal };
export type PutTransport = (target: Pick<SignedUpload, "url" | "headers">, body: Blob, opts: PutOptions) => Promise<void>;

let mockTransport: PutTransport | null = null;
export function registerMockPutTransport(t: PutTransport | null) { mockTransport = t; }

/** Headers to send: everything signed except Content-Length (a forbidden header; the browser sets it). */
export function sendableHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() !== "content-length") out[k] = v;
  return out;
}

export function putToSignedUrl(target: Pick<SignedUpload, "url" | "headers">, body: Blob, opts: PutOptions = {}): Promise<void> {
  if (target.url.startsWith("mock://")) {
    if (!mockTransport) return Promise.reject(new AppError("upload_failed", "Mock upload transport is not registered."));
    return mockTransport(target, body, opts);
  }
  return new Promise<void>((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new AppError("network_error", "Cancelled."));
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.url);
    for (const [k, v] of Object.entries(sendableHeaders(target.headers))) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) opts.onProgress?.(e.loaded, e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { opts.onProgress?.(body.size, body.size); resolve(); }
      else reject(new AppError("upload_failed", undefined, { status: xhr.status }));
    };
    xhr.onerror = () => reject(new AppError("upload_failed"));
    xhr.ontimeout = () => reject(new AppError("upload_failed"));
    xhr.onabort = () => reject(new AppError("network_error", "Cancelled."));
    opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}
