// Flow 5.6 on the real stack: R2 failures injected in the browser (an expired/refused presigned PUT for a slide image, an aborted clip PUT).
// The UI must recover through the real backend without consuming a second daily session. Student A: 1 upload (3 slide-reading credits),
// 1 analysis of one clip.
import path from "node:path";
import { expect, test } from "@playwright/test";
import { watchConsole } from "./support/console";
import { signedInContext } from "./support/session";

test("expired image URL → fresh URLs + retry; aborted clip upload → Try again re-sends only that clip; one daily session", async ({ browser, baseURL }) => {
  test.setTimeout(540_000);
  const { ctx, client } = await signedInContext(browser, "A", baseURL!);
  const page = await ctx.newPage(); const con = watchConsole(page, [/Failed to load resource/, /net::ERR_FAILED/, /CORS|ERR_BLOCKED/]);
  const calls: Record<string, number> = {};
  page.on("request", (r) => { const m = r.url().match(/\/functions\/v1\/([a-z-]+)/); if (m && r.method() === "POST") calls[m[1]!] = (calls[m[1]!] ?? 0) + 1; });

  // inject: the first image PUT is refused like an expired signature; the first clip PUT dies on the network
  let imageRefused = 0, clipAborted = 0, imagePuts = 0, clipPuts = 0;
  await page.route(/r2\.cloudflarestorage\.com/, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.continue();
    if (req.method() !== "PUT") return route.continue();
    const type = req.headers()["content-type"] ?? "";
    if (type.startsWith("image/jpeg")) {
      imagePuts++;
      if (imageRefused === 0) { imageRefused++; return route.fulfill({ status: 403, headers: { "access-control-allow-origin": "*", "content-type": "application/xml" }, body: "<Error><Code>SignatureDoesNotMatch</Code></Error>" }); }
    }
    if (type.startsWith("audio/wav")) {
      clipPuts++;
      if (clipAborted === 0) { clipAborted++; return route.abort("failed"); }
    }
    return route.continue();
  });

  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(path.resolve("tests/fixtures/deck-3.pdf"));
  await expect(page).toHaveURL(/\/practice\/[^/]+\/reading/, { timeout: 120_000 });
  const deckId = page.url().match(/practice\/([^/]+)\/reading/)![1]!;
  await expect(page).toHaveURL(/\/prepare/, { timeout: 180_000 });
  expect(imageRefused).toBe(1);
  expect(imagePuts).toBe(4); // 3 slides + the one that was refused and retried with fresh URLs
  expect(calls["deck-upload-complete"]).toBeGreaterThanOrEqual(2); // re-issued the image URLs (idempotent)
  const { data: usage } = await client.from("usage_events").select("id");
  expect(usage).toHaveLength(1); // the refused PUT did not consume another session
  const { data: deck } = await client.from("decks").select("status,processed_slides").eq("id", deckId).single();
  expect(deck).toMatchObject({ status: "ready", processed_slides: 3 });

  await page.goto(`/practice/${deckId}/time`);
  await page.getByRole("tab", { name: "5 min" }).click();
  await page.getByRole("button", { name: "Continue to mic check" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(5500);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Review and submit" }).first().click();
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await page.getByRole("button", { name: "Submit anyway" }).click();

  // the aborted clip PUT surfaces as an inline failure with Try again
  await expect(page.getByText("Some recordings didn't upload")).toBeVisible({ timeout: 60_000 });
  expect(clipAborted).toBe(1);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/analysing/, { timeout: 60_000 });
  expect(clipPuts).toBe(2);
  expect(calls["session-submit-init"]).toBe(2); // fresh URLs requested for the retry

  // analysis (retry the AI-busy failure card when the model answers 503)
  for (let i = 0, retries = 0, t = Date.now(); !/\/reports\//.test(page.url()) && Date.now() - t < 280_000; i++) {
    const retry = page.getByRole("button", { name: "Try again" });
    if (retries < 3 && (await retry.isVisible().catch(() => false))) { retries++; await retry.click(); }
    await page.waitForTimeout(500);
  }
  await expect(page).toHaveURL(/\/reports\//, { timeout: 10_000 });
  await expect(page.getByText("Not recorded").first()).toBeVisible(); // slides 2 and 3 were skipped
  const { data: usage2 } = await client.from("usage_events").select("id");
  expect(usage2).toHaveLength(1);
  const { data: sess } = await client.from("practice_sessions").select("status,attempt_number").eq("deck_id", deckId);
  expect(sess).toEqual([{ status: "completed", attempt_number: 1 }]);
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
  await ctx.close();
});
