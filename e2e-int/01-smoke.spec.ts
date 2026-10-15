import { expect, test } from "@playwright/test";
import { watchConsole } from "./support/console";
import { signedInContext } from "./support/session";

test("anonymous: public pages read the real policy; protected pages go to sign-in", async ({ page }) => {
  const con = watchConsole(page);
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms" })).toBeVisible();
  await expect(page.locator("main")).toContainText(/Mock2Pitch/i);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
});

test("signed-in student A: real session, profile and dashboard stats", async ({ browser, baseURL }) => {
  const { ctx } = await signedInContext(browser, "A", baseURL!);
  const page = await ctx.newPage();
  const con = watchConsole(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: /ready to rehearse/ })).toBeVisible();
  await expect(page.getByText("0 of 5 sessions")).toBeVisible();
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
  await ctx.close();
});
