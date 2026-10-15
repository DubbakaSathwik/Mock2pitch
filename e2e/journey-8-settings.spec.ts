import { expect, test } from "./fixtures";
import { seed } from "./helpers";

test("8. settings: edit profile, view Terms read-only, delete account with typed confirmation", async ({ page }) => {
  await seed(page, "returning_student");
  await page.goto("/settings");
  await page.getByLabel("College").fill("NIT Calicut");
  await page.getByLabel("Year").selectOption("4th year");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("College")).toHaveValue("NIT Calicut");

  // limits tiles
  await expect(page.getByText("2 of 5 used today")).toBeVisible();
  await expect(page.getByText("Up to 10", { exact: true })).toBeVisible();
  await expect(page.getByText("Up to 20 minutes")).toBeVisible();

  // Terms: view-only (no checkbox), Back returns to settings
  await page.getByRole("link", { name: "Terms" }).click();
  await expect(page).toHaveURL(/\/terms\?from=settings/);
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Terms text" })).toContainText("Using Mock2Pitch");
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(/\/settings/);

  // delete account
  await page.getByRole("button", { name: "Delete account" }).click();
  const dlg = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(dlg).toBeVisible();
  const confirm = dlg.getByRole("button", { name: "Delete account" });
  await expect(confirm).toBeDisabled();
  await dlg.getByLabel("Type DELETE to confirm").fill("delete");
  await expect(confirm).toBeDisabled();
  await dlg.getByLabel("Type DELETE to confirm").fill("DELETE");
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Your account was deleted")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: /Rehearse your pitch/ })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("8b. sign out returns to the landing page", async ({ page }) => {
  await seed(page, "student");
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
});
