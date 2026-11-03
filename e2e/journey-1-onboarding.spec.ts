import { expect, test } from "./fixtures";
import { seed } from "./helpers";

test("1. new student: landing → sign in → terms → profile → empty dashboard", async ({ page }) => {
  await seed(page, "signed_out");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Rehearse your pitch in private/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole("button", { name: "Continue with Google" }).click();

  // first-time terms: Continue disabled until the box is ticked
  await expect(page).toHaveURL(/\/onboarding\/terms/, { timeout: 45_000 }); // generous: the first navigation of a cold dev server compiles routes
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(cont).toBeDisabled();
  await page.getByRole("tab", { name: "Privacy Policy" }).click();
  await expect(page.getByRole("region", { name: "Privacy Policy text" })).toContainText("What we collect");
  await page.getByLabel("I have read and agree to the Terms and the Privacy Policy").check();
  await expect(cont).toBeEnabled();
  await cont.click();

  // profile: validation error, then success
  await expect(page).toHaveURL(/\/onboarding\/profile/);
  // the name starts as the Google name and can be changed; it cannot be left empty
  await expect(page.getByLabel("Your name")).toHaveValue("Ananya Rao");
  await page.getByLabel("Your name").fill("");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await expect(page.getByText("Enter your college name")).toBeVisible();
  await page.getByLabel("Your name").fill("Ananya Rao-Iyer");
  await page.getByLabel("College").fill("RV Institute of Technology");
  await page.getByLabel("Year").selectOption("4th year");
  await page.getByLabel("Branch").selectOption("ECE");
  await page.getByRole("button", { name: "Save and continue" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1, name: /Hi Ananya, ready to rehearse/ })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) >= 760) await expect(page.getByText("Ananya Rao-Iyer").first()).toBeVisible(); // the edited name is what the sidebar shows (mobile shows initials only)
  await expect(page.getByText("Your first practice starts here")).toBeVisible();
  await expect(page.getByText("Ready for your first practice")).toBeVisible();
  await expect(page.getByText("0 of 5 sessions")).toBeVisible();
});
