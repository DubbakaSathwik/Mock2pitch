// @smoke — runs in the WebKit project (Safari engine): onboarding, upload (pdf.js legacy build), prepare. No microphone in WebKit CI.
import { expect, test } from "@playwright/test";
import { fixture, seed } from "./helpers";

test("@smoke landing → sign in → terms → profile → dashboard → upload a PDF → prepare", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "signed_out");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Rehearse your pitch in private/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  // diagnostics for CI (the first WebKit runs): say where we are instead of timing out on a label
  await page.waitForURL(/onboarding\/terms/, { timeout: 20_000 }).catch(async () => {
    throw new Error(`not on the Terms screen: ${page.url()} :: ${(await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 500)}`);
  });
  await page.getByLabel("I have read and agree to the Terms and the Privacy Policy").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("College").fill("RV Institute of Technology");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/prepare/, { timeout: 90_000 });
  await expect(page.getByTestId("slide-view").first()).toBeVisible();
  const loaded = await page.getByTestId("slide-view").first().locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0);
  expect(loaded).toBe(true);
});
