// @smoke — runs in the WebKit project (Safari engine): onboarding, upload (pdf.js legacy build), prepare. No microphone in WebKit CI.
import { expect, test } from "@playwright/test";
import { fixture, seed } from "./helpers";

test("@smoke landing → sign in → terms → profile → dashboard → upload a PDF → prepare", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "signed_out");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Rehearse your pitch in private/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  // A cold `next dev` in a fresh CI job can still be hydrating when the button first appears, so a click can land before React attached
  // its handler (seen in WebKit, the only test in that job). Retry the click until the app actually moves on.
  await expect(async () => {
    if (!/onboarding\/terms/.test(page.url())) await page.getByRole("button", { name: "Continue with Google" }).click({ timeout: 5_000 });
    await expect(page).toHaveURL(/onboarding\/terms/, { timeout: 8_000 });
  }).toPass({ timeout: 90_000 });
  await page.getByLabel("I have read and agree to the Terms and the Privacy Policy").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("College").fill("RV Institute of Technology");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  // Navigate inside the app (a full reload is not what a user does here, and the mock backend keeps its state in sessionStorage, which
  // WebKit in CI did not carry across a reload: the guard bounced /practice/new back to /dashboard).
  await page.getByRole("button", { name: "Upload slides" }).first().click();
  await expect(page).toHaveURL(/\/practice\/new/);
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/prepare/, { timeout: 90_000 });
  await expect(page.getByTestId("slide-view").first()).toBeVisible();
  const loaded = await page.getByTestId("slide-view").first().locator("img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0);
  expect(loaded).toBe(true);
});
