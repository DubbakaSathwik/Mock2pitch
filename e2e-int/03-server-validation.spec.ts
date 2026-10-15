// Flow 5.5 (server side): uploads are validated by the backend even when every client check is bypassed. No AI credits are used and no
// daily session is consumed by any rejected upload. Runs as student B.
import { expect, test } from "@playwright/test";
import { fixtureBytes, putSigned, userApi } from "./support/api";

test.describe.configure({ mode: "serial" });
let api: Awaited<ReturnType<typeof userApi>>;
test.beforeAll(async () => { api = await userApi("B"); });

const usage = async () => (await api.client.from("usage_events").select("id")).data!.length;
const init = (filename: string, size: number, type = "application/pdf") => api.fn("deck-upload-init", { filename, size_bytes: size, content_type: type });

test("init rejects a non-PDF content type, a non-.pdf name and > 5 MB", async () => {
  const u0 = await usage();
  expect((await init("a.pdf", 100, "image/png")).error?.code).toBe("not_pdf");
  expect((await init("notes.txt", 100)).error?.code).toBe("not_pdf");
  const big = await init("big.pdf", 5 * 1024 * 1024 + 1);
  expect(big.status).toBe(413); expect(big.error?.code).toBe("too_large");
  expect(await usage()).toBe(u0);
});

test("complete without an uploaded object → upload_missing", async () => {
  const r = await init("missing.pdf", 100);
  expect(r.ok).toBe(true);
  const c = await api.fn("deck-upload-complete", { deck_id: r.data!.deck_id });
  expect(c.error?.code).toMatch(/upload_missing|size_mismatch/);
});

test.describe("content validation after a real upload to R2", () => {
  const cases: [string, string, string][] = [
    ["a non-PDF with a .pdf name", "not-a-pdf.pdf", "not_pdf"],
    ["an encrypted PDF", "deck-encrypted.pdf", "encrypted_pdf"],
    ["a corrupt PDF", "corrupt.pdf", "corrupt_pdf"],
    ["an 11-page PDF", "deck-11-pages.pdf", "too_many_pages"],
  ];
  for (const [label, file, code] of cases) {
    test(`${label} → ${code}; deck failed, nothing consumed`, async () => {
      const bytes = fixtureBytes(file);
      const u0 = await usage();
      const i = await init(file, bytes.length);
      expect(i.ok, JSON.stringify(i.error)).toBe(true);
      const put = await putSigned(i.data!.upload, bytes);
      expect(put.status, put.text).toBeLessThan(300);
      const c = await api.fn("deck-upload-complete", { deck_id: i.data!.deck_id });
      expect(c.error?.code).toBe(code);
      if (code === "too_many_pages") { expect(c.error?.page_count).toBe(11); expect(c.error?.max_pages).toBe(10); }
      const { data: deck } = await api.client.from("decks").select("status,error_code").eq("id", i.data!.deck_id).single();
      expect(deck).toMatchObject({ status: "failed", error_code: code });
      expect(await usage()).toBe(u0); // not consumed
    });
  }
});

test("wrong signed Content-Type / tampered upload is refused by R2", async () => {
  const bytes = fixtureBytes("deck-3.pdf");
  const i = await init("tamper.pdf", bytes.length);
  expect(i.ok).toBe(true);
  const bad = await putSigned(i.data!.upload, bytes, "text/plain");
  expect(bad.status).toBeGreaterThanOrEqual(400); // SignatureDoesNotMatch: Content-Type is part of the signature
  const short = await putSigned(i.data!.upload, bytes.subarray(0, bytes.length - 10));
  expect(short.status).toBeGreaterThanOrEqual(400); // Content-Length is signed too
});

test("unauthenticated and forged tokens are rejected (gateway or function)", async () => {
  const f = async (headers: Record<string, string>) => (await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/deck-upload-init`, { method: "POST", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json", ...headers }, body: "{}" })).status;
  expect(await f({})).toBe(401);
  expect(await f({ Authorization: "Bearer not.a.jwt" })).toBe(401);
  const forged = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDE3MDIiLCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImV4cCI6OTk5OTk5OTk5OX0.invalidsignature";
  expect(await f({ Authorization: `Bearer ${forged}` })).toBe(401);
});
