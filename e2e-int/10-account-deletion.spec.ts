// Flow 5.8: deleting an account through the real UI removes the auth user, every row and every R2 object. Student DEL uploads one 3-slide deck
// (3 slide-reading credits, 1 session), then deletes the account from Settings. Evidence: a presigned image URL that worked before returns 404
// afterwards, password sign-in fails, and the SQL residue query (docs/phase-3/integration.md) returns 0 rows for the user.
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { userApi } from "./support/api";
import { watchConsole } from "./support/console";
import { ANON_KEY, creds, SUPABASE_URL, signedInContext } from "./support/session";

test("upload a deck → Settings → Delete account → everything is gone (rows, auth user, R2 objects)", async ({ browser, baseURL }) => {
  test.setTimeout(420_000);
  const { ctx, client, userId } = await signedInContext(browser, "DEL", baseURL!);
  const page = await ctx.newPage(); const con = watchConsole(page, [/status of 40[13]/, /Failed to load resource/]);

  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(path.resolve("tests/fixtures/deck-3.pdf"));
  await expect(page).toHaveURL(/\/practice\/[^/]+\/reading/, { timeout: 120_000 });
  const deckId = page.url().match(/practice\/([^/]+)\/reading/)![1]!;
  await expect(page).toHaveURL(/\/prepare/, { timeout: 180_000 });

  const api = await userApi("DEL");
  const urls = await api.fn("asset-urls", { deck_id: deckId, kinds: ["slide_image", "deck_pdf"] });
  expect(urls.ok, JSON.stringify(urls.error)).toBe(true);
  const imageUrl = (urls.data as any).slide_images?.[0]?.url ?? (urls.data as any).images?.[0]?.url ?? JSON.stringify(urls.data).match(/https:\/\/[^"]+/)![0];
  const pdfUrl = (urls.data as any).deck_pdf?.url ?? (urls.data as any).pdf?.url;
  expect((await fetch(imageUrl)).status).toBe(200);
  if (pdfUrl) expect((await fetch(pdfUrl)).status).toBe(200);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete account" }).click();
  const dlg = page.getByRole("dialog");
  const confirm = dlg.getByRole("button", { name: "Delete account" });
  await expect(confirm).toBeDisabled();
  await dlg.getByRole("textbox").fill("DELETE");
  await confirm.click();
  await expect(page).toHaveURL(baseURL + "/", { timeout: 60_000 });
  await expect(page.getByText("Your account was deleted")).toBeVisible();

  // the signed URLs outlive the account only until R2 is emptied: both objects are gone
  expect((await fetch(imageUrl)).status).toBe(404);
  if (pdfUrl) expect((await fetch(pdfUrl)).status).toBe(404);
  // the auth user is gone
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const login = await anon.auth.signInWithPassword(creds("DEL"));
  expect(login.error, "sign-in must fail after deletion").not.toBeNull();
  // the old session no longer reads anything
  const stale = await client.from("decks").select("id");
  expect((stale.data ?? []).length).toBe(0);
  // and a protected page sends the browser to sign-in
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/, { timeout: 30_000 });
  console.log(`deleted user ${userId}, deck ${deckId}`);
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
  await ctx.close();
});
