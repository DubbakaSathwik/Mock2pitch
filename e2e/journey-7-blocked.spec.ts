import { expect, test } from "./fixtures";
import { seed } from "./helpers";

test("7. blocked student → /paused, practice disabled, History and reports stay readable", async ({ page }) => {
  await seed(page, "blocked");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/paused/);
  await expect(page.getByRole("heading", { level: 1, name: "Your account is paused" })).toBeVisible();
  await expect(page.getByText("The Mock2Pitch owner has paused your access. Your reports are still saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // "New practice" does not lead to the upload screen
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "New practice" }).click();
  await expect(page).toHaveURL(/\/paused/);
  await page.goto("/practice/new");
  await expect(page).toHaveURL(/\/paused/);

  // read-only areas work
  await page.goto("/history");
  await expect(page.getByTestId("deck-row")).toHaveCount(1);
  await page.getByRole("link", { name: "ParkSense hackathon pitch" }).click();
  await page.getByLabel("Attempts").getByText("Attempt 2").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Clear and confident");
  await expect(page.getByRole("button", { name: "Retake this presentation" })).toBeDisabled();

  // writes are refused with a clear message
  await page.goto("/history");
  await page.getByRole("button", { name: "Pin ParkSense hackathon pitch" }).click();
  await expect(page.getByText("Your account is paused.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click().catch(() => {});
});
