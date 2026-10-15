import { expect, test } from "./fixtures";
import { control, seed } from "./helpers";

test("10. guards: signed-out deep link → sign in → returns to the deep link; no protected content flash", async ({ page }) => {
  await seed(page, "signed_out");
  await page.addInitScript(() => {
    (window as unknown as { __sawProtected: boolean }).__sawProtected = false;
    new MutationObserver(() => { if (document.querySelector("main h1")?.textContent === "History") (window as unknown as { __sawProtected: boolean }).__sawProtected = true; }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/history");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fhistory/);
  // nothing from the protected page was ever rendered while signed out
  expect(await page.evaluate(() => (window as any).__sawProtected)).toBe(false);
  const c = await control(page);
  await page.waitForFunction(() => !!(window as unknown as { __m2pMock?: unknown }).__m2pMock); // the hook is installed after hydration
  await page.evaluate(() => (window as any).__m2pMock.setNextSignIn("returning_student"));
  void c;
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByRole("heading", { level: 1, name: "History" })).toBeVisible();
});

test("10b. open-redirect attempts in ?next= are ignored", async ({ page }) => {
  await seed(page, "signed_out");
  await page.goto("/sign-in?next=https%3A%2F%2Fevil.example%2F");
  await page.waitForFunction(() => !!(window as unknown as { __m2pMock?: unknown }).__m2pMock); // the hook is installed after hydration
  await page.evaluate(() => (window as any).__m2pMock.setNextSignIn("student"));
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("10c. signed-out visitors see only public pages", async ({ page }) => {
  await seed(page, "signed_out");
  for (const path of ["/dashboard", "/practice/new", "/settings", "/limit", "/reports/x"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in/);
  }
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  for (const path of ["/", "/terms", "/privacy", "/sign-in"]) { await page.goto(path); await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`)); }
});
