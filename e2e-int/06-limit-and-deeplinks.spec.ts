// Flows 5.5 (limit, client-side checks) and 5.10 (guards, deep links, redirects) on the real stack. Student B has 5 usage events seeded in the
// database for today (IST) so the daily limit can be exercised without spending AI credits.
import { expect, test } from "@playwright/test";
import path from "node:path";
import { userApi } from "./support/api";
import { watchConsole } from "./support/console";
import { passwordSession, signedInContext } from "./support/session";

test("daily limit: S18 with the IST reset time; the direct upload call is refused without creating a deck", async ({ browser, baseURL }) => {
  const api = await userApi("B");
  const { data: stats } = await api.client.rpc("my_dashboard_stats");
  expect(stats![0]).toMatchObject({ sessions_used_today: 5, daily_limit: 5 });
  expect(new Date(stats![0].next_reset_at).toISOString()).toMatch(/T18:30:00\.000Z$/); // next IST midnight

  const decksBefore = (await api.client.from("decks").select("id")).data!.length;
  const direct = await api.fn("deck-upload-init", { filename: "a.pdf", size_bytes: 100, content_type: "application/pdf" });
  expect(direct.status).toBe(429); expect(direct.error?.code).toBe("daily_limit_reached");
  expect((await api.client.from("decks").select("id")).data!.length).toBe(decksBefore);

  const { ctx } = await signedInContext(browser, "B", baseURL!);
  const page = await ctx.newPage(); const con = watchConsole(page, [/status of 429/]);
  await page.goto("/dashboard");
  await expect(page.getByText("5 of 5 sessions")).toBeVisible({ timeout: 60_000 });
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(path.resolve("tests/fixtures/deck-3.pdf"));
  await expect(page).toHaveURL(/\/limit/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: /Time to rest/ })).toBeVisible();
  await expect(page.getByText(/resets at midnight IST/i)).toBeVisible();
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
  await ctx.close();
});

test("client-side 11-slide check shows 'That deck has 11 slides' and makes no backend call", async ({ browser, baseURL }) => {
  const { ctx } = await signedInContext(browser, "A", baseURL!);
  const page = await ctx.newPage(); const con = watchConsole(page);
  const calls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/functions/v1/")) calls.push(r.url()); });
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(path.resolve("tests/fixtures/deck-11.pdf"));
  await expect(page.getByTestId("upload-error")).toContainText("That deck has 11 slides");
  expect(calls).toEqual([]);
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
  await ctx.close();
});

test("guards: signed-out deep link → sign-in carries `next`; once signed in the deep link opens; open redirects are ignored; OAuth errors show the sign-in error", async ({ browser, baseURL }) => {
  const anon = await browser.newContext({ baseURL });
  const p = await anon.newPage(); const con = watchConsole(p);
  await p.goto("/history");
  await expect(p).toHaveURL(/\/sign-in\?next=%2Fhistory/);
  await expect(p.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  // no protected content was ever rendered for the signed-out visitor
  await expect(p.getByText("Your reports, grouped by deck")).toHaveCount(0);
  await p.goto("/admin");
  await expect(p).toHaveURL(/\/admin\/sign-in/);
  await p.goto("/auth/callback?error=access_denied&error_description=User+denied");
  await expect(p).toHaveURL(/\/sign-in\?error=oauth/);
  await expect(p.getByText("Sign-in didn't finish. Try again.")).toBeVisible();
  await p.goto("/auth/callback"); // no code
  await expect(p).toHaveURL(/\/sign-in\?error=oauth/);
  await p.goto("/auth/callback?code=bogus&next=https://evil.example");
  await expect(p).toHaveURL(/\/sign-in\?error=oauth/);
  expect(con.errors().filter((e) => !/status of 400|status of 401/.test(e)), con.errors().join("\n")).toEqual([]);
  await anon.close();

  // signed in (cookies as set by the OAuth callback): the sign-in page forwards to `next`, never to an external URL
  const { ctx } = await signedInContext(browser, "A", baseURL!);
  const page = await ctx.newPage();
  await page.goto("/sign-in?next=%2Fhistory");
  await expect(page).toHaveURL(/\/history$/, { timeout: 60_000 });
  for (const evil of ["//evil.example", "https://evil.example", "/\\evil.example", "/auth/callback"]) {
    await page.goto(`/sign-in?next=${encodeURIComponent(evil)}`);
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
    expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
  }
  // cross-role redirects
  await page.goto("/admin/students");
  await expect(page).toHaveURL(/\/dashboard$/);
  await ctx.close();
  const adm = await signedInContext(browser, "ADMIN", baseURL!);
  const ap = await adm.ctx.newPage();
  await ap.goto("/practice/new");
  await expect(ap).toHaveURL(/\/admin$/, { timeout: 60_000 });
  await adm.ctx.close();
  void passwordSession;
});
