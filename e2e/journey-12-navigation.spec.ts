import { expect, test } from "./fixtures";
import { seed } from "./helpers";

test("12a. the logo goes to the dashboard from inside the app, and every flow page has a Back link to the previous step", async ({ page }) => {
  await seed(page, "returning_student", { latencyMs: 0 });
  await page.goto("/history");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("back-link")).toHaveAttribute("href", "/dashboard");
  await page.getByRole("link", { name: "Mock2Pitch home" }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/practice/new");
  await expect(page.getByTestId("back-link")).toHaveAttribute("href", "/dashboard");
  await page.getByTestId("back-link").click();
  await expect(page).toHaveURL(/\/dashboard/);

  const deck = "00000000-0000-4000-8000-00000000d001";
  await page.goto(`/practice/${deck}/time`);
  await expect(page.getByTestId("back-link")).toHaveAttribute("href", `/practice/${deck}/prepare`);
  await page.goto(`/practice/${deck}/prepare`);
  await expect(page.getByTestId("back-link")).toHaveAttribute("href", "/practice/new");
  await page.goto(`/history/${deck}`);
  await expect(page.getByTestId("back-link")).toHaveAttribute("href", "/history");
});

test("12b. landing: the logo and both sign-in buttons work, and a click gives immediate feedback", async ({ page }) => {
  await seed(page, "signed_out");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Mock2Pitch home" })).toHaveAttribute("href", "/");
  const header = page.getByRole("button", { name: "Sign in" });
  await header.click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("button", { name: "Continue with Google" }).first().click();
  await expect(page).toHaveURL(/\/sign-in/);
});
