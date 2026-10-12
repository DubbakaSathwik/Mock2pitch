// R2 client + presigning, verified against a fake S3 server that independently re-computes SigV4.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { R2, keys } from "@shared/r2.ts";
import { startFakeS3, type FakeS3 } from "../helpers/fake-s3";

const cfg = { accountId: "acct", accessKeyId: "AKIATEST", secretAccessKey: "sekrit/with+chars", bucket: "mock2pitch-test" };
let s3: FakeS3; let r2: R2; let clock = Date.now();
const U = "5b0a1c36-5d6a-4a53-9d4c-0e0f6a5c1111", D = "6c1b2d47-6e7b-4b64-8e5d-1f1a7b6d2222", S = "7d2c3e58-7f8c-4c75-9f6e-2a2b8c7e3333";

beforeAll(async () => {
  s3 = await startFakeS3({ ...cfg, now: () => clock });
  r2 = new R2({ ...cfg, endpoint: s3.endpoint });
});
afterAll(async () => { await s3.stop(); });

describe("presigned PUT", () => {
  const body = new TextEncoder().encode("%PDF-1.7 hello");
  it("accepts the exact type + length it was signed for", async () => {
    const p = await r2.presignPut(keys.deckPdf(U, D), { contentType: "application/pdf", contentLength: body.length, expiresS: 300 });
    expect(p.method).toBe("PUT");
    expect(new URL(p.url).searchParams.get("X-Amz-Expires")).toBe("300");
    expect(new URL(p.url).searchParams.get("X-Amz-SignedHeaders")).toMatch(/content-length.*content-type|content-type.*content-length/);
    const res = await fetch(p.url, { method: "PUT", body, headers: { "Content-Type": "application/pdf" } });
    expect(res.status).toBe(200);
    expect(await r2.head(keys.deckPdf(U, D))).toEqual({ size: body.length, contentType: "application/pdf" });
  });
  it("rejects a different Content-Type", async () => {
    const p = await r2.presignPut(keys.slideImage(U, D, 0), { contentType: "image/jpeg", contentLength: 3, expiresS: 300 });
    const res = await fetch(p.url, { method: "PUT", body: new Uint8Array([1, 2, 3]), headers: { "Content-Type": "text/html" } });
    expect(res.status).toBe(403);
    expect(await r2.head(keys.slideImage(U, D, 0))).toBeNull();
  });
  it("rejects a body whose length differs from the signed Content-Length", async () => {
    const p = await r2.presignPut(keys.slideImage(U, D, 1), { contentType: "image/jpeg", contentLength: 3, expiresS: 300 });
    const res = await fetch(p.url, { method: "PUT", body: new Uint8Array([1, 2, 3, 4, 5, 6]), headers: { "Content-Type": "image/jpeg" } });
    expect(res.status).toBe(403);
    expect(await r2.head(keys.slideImage(U, D, 1))).toBeNull();
  });
  it("rejects a tampered key or query parameter", async () => {
    const p = await r2.presignPut(keys.slideImage(U, D, 2), { contentType: "image/jpeg", contentLength: 3, expiresS: 300 });
    const other = p.url.replace("/slides/2.jpg", "/slides/3.jpg");
    expect((await fetch(other, { method: "PUT", body: new Uint8Array([1, 2, 3]), headers: { "Content-Type": "image/jpeg" } })).status).toBe(403);
    const longer = p.url.replace("X-Amz-Expires=300", "X-Amz-Expires=9999");
    expect((await fetch(longer, { method: "PUT", body: new Uint8Array([1, 2, 3]), headers: { "Content-Type": "image/jpeg" } })).status).toBe(403);
  });
  it("rejects after expiry", async () => {
    const p = await r2.presignPut(keys.slideImage(U, D, 4), { contentType: "image/jpeg", contentLength: 3, expiresS: 300 });
    const early = clock; clock = early + 299_000;
    expect((await fetch(p.url, { method: "PUT", body: new Uint8Array([1, 2, 3]), headers: { "Content-Type": "image/jpeg" } })).status).toBe(200);
    clock = early + 301_000;
    const p2 = p.url; // same URL, now past 5 minutes
    expect((await fetch(p2, { method: "PUT", body: new Uint8Array([9, 9, 9]), headers: { "Content-Type": "image/jpeg" } })).status).toBe(403);
    clock = early;
  });
});

describe("presigned GET + server operations", () => {
  it("serves a presigned GET until expiry, and unsigned access is denied", async () => {
    await r2.put(keys.audioClip(U, S, 0), new Uint8Array([7, 7, 7]), "audio/wav");
    const g = await r2.presignGet(keys.audioClip(U, S, 0), 600);
    const ok = await fetch(g.url);
    expect(ok.status).toBe(200);
    expect(Array.from(new Uint8Array(await ok.arrayBuffer()))).toEqual([7, 7, 7]);
    const unsigned = await fetch(`${s3.endpoint}/${cfg.bucket}/${keys.audioClip(U, S, 0)}`);
    expect(unsigned.status).toBe(403);
    const t0 = clock; clock = t0 + 601_000;
    expect((await fetch(g.url)).status).toBe(403);
    clock = t0;
  });
  it("one user's presigned URL cannot be edited to read another key", async () => {
    await r2.put(keys.audioClip(U, S, 1), new Uint8Array([1]), "audio/wav");
    const g = await r2.presignGet(keys.audioClip(U, S, 0), 600);
    expect((await fetch(g.url.replace("/audio/0.wav", "/audio/1.wav"))).status).toBe(403);
  });
  it("head / range get / delete (idempotent) / missing", async () => {
    const k = keys.slideImage(U, D, 9);
    await r2.put(k, new Uint8Array([10, 11, 12, 13, 14]), "image/jpeg");
    expect((await r2.head(k))?.size).toBe(5);
    expect(Array.from(await r2.getRange(k, 1, 3))).toEqual([11, 12, 13]);
    await r2.delete(k); await r2.delete(k);
    expect(await r2.head(k)).toBeNull();
  });
  it("lists across pages and deletes a whole prefix; throws if any delete fails", async () => {
    for (let i = 0; i < 5; i++) await r2.put(`users/${U}/x/${i}.bin`, new Uint8Array([i]), "application/octet-stream");
    await r2.put(`users/other/x/0.bin`, new Uint8Array([1]), "application/octet-stream");
    expect((await r2.list(`users/${U}/x/`)).length).toBe(5);
    expect(await r2.deletePrefix(`users/${U}/x/`)).toBe(5);
    expect(s3.keys().some((k) => k.startsWith(`users/${U}/x/`))).toBe(false);
    expect(s3.keys()).toContain("users/other/x/0.bin");
    const s3b = await startFakeS3({ ...cfg, failDelete: (k) => k.endsWith("1.bin") });
    const r2b = new R2({ ...cfg, endpoint: s3b.endpoint });
    for (let i = 0; i < 3; i++) await r2b.put(`p/${i}.bin`, new Uint8Array([i]), "x/y");
    await expect(r2b.deletePrefix("p/")).rejects.toThrow(/r2_delete_500/);
    await s3b.stop();
  });
  it("all server requests were validly signed", () => {
    const bad = s3.requests.filter((r) => !r.ok && !["signature_mismatch", "expired", "no_auth"].includes(r.reason ?? ""));
    expect(bad).toEqual([]);
  });
});

describe("object keys", () => {
  it("are built only from valid ids", () => {
    expect(keys.deckPdf(U, D)).toBe(`users/${U}/decks/${D}/source.pdf`);
    expect(keys.slideImage(U, D, 3)).toBe(`users/${U}/decks/${D}/slides/3.jpg`);
    expect(keys.audioClip(U, S, 0)).toBe(`users/${U}/sessions/${S}/audio/0.wav`);
    expect(() => keys.deckPdf("../etc", D)).toThrow("bad_id");
    expect(() => keys.deckPdf(U, `${D}/../../x`)).toThrow("bad_id");
    expect(() => keys.slideImage(U, D, 10)).toThrow("bad_index");
    expect(() => keys.audioClip(U, S, -1)).toThrow("bad_index");
  });
});

describe("infra/r2-cors.json", () => {
  const cors = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../infra/r2-cors.json"), "utf8"));
  it("has no wildcard origin and only the needed methods/headers", () => {
    const rule = cors[0];
    expect(rule.AllowedOrigins.some((o: string) => o === "*" || o.includes("*"))).toBe(false);
    expect(rule.AllowedOrigins).toContain("http://localhost:3000");
    expect(rule.AllowedMethods.sort()).toEqual(["GET", "HEAD", "PUT"]);
    expect(rule.AllowedHeaders.sort()).toEqual(["Content-Length", "Content-Type"]);
  });
});
