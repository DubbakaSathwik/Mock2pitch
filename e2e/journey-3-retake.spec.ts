import { expect, test } from "./fixtures";
import { control, fixture, micGate, seed } from "./helpers";

test("3. retake: report → retake (cost note) → report with delta; history, pin and deck detail", async ({ page }) => {
  test.setTimeout(240_000);
  await seed(page, "returning_student", { stageMs: 150 });
  await micGate(page, false);

  // upload a second deck so pin ordering is visible
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/prepare/, { timeout: 60_000 });

  // History: new deck first, ParkSense second → pin ParkSense → it moves first, toasts both ways
  await page.goto("/history");
  const rows = page.getByTestId("deck-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("deck-3");
  await page.getByRole("button", { name: "Pin ParkSense hackathon pitch" }).click();
  await expect(page.getByText("Deck pinned to top")).toBeVisible();
  await expect(rows.first()).toContainText("ParkSense hackathon pitch");
  await expect(rows.first()).toContainText("Pinned");
  await page.getByRole("button", { name: "Unpin ParkSense hackathon pitch" }).click();
  await expect(page.getByText("Deck unpinned")).toBeVisible();
  await expect(rows.first()).toContainText("deck-3");
  await page.getByRole("button", { name: "Pin ParkSense hackathon pitch" }).click();

  // Deck detail: first vs latest
  await page.getByRole("link", { name: "ParkSense hackathon pitch" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "ParkSense hackathon pitch" })).toBeVisible();
  await expect(page.getByText("Sub-scores by attempt")).toBeVisible();
  await expect(page.getByLabel("Attempts").getByText("Attempt 2")).toBeVisible();
  await page.getByLabel("Attempts").getByText("Attempt 2").click();
  await expect(page).toHaveURL(/\/reports\//);
  await expect(page.getByText("+12 from your first attempt (62)")).toBeVisible();

  // Retake: cost note, time page prefilled, record one slide, submit anyway
  await expect(page.getByText("A retake uses 1 of your 5 sessions today.")).toBeVisible();
  await page.getByRole("button", { name: "Retake this presentation" }).click();
  await expect(page).toHaveURL(/\/time/);
  await expect(page.getByText("This retake uses 1 of your 5 sessions today.")).toBeVisible();
  await expect(page.getByLabel("Total duration (minutes)")).toHaveValue("5");
  await page.getByRole("button", { name: "Continue to mic check" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Review and submit" }).first().click();
  await expect(page.getByText("7 slides are not recorded yet.")).toBeVisible();
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await expect(page.getByRole("dialog", { name: "Submit with unrecorded slides?" })).toBeVisible();
  await page.getByRole("button", { name: "Submit anyway" }).click();
  await expect(page).toHaveURL(/\/reports\//, { timeout: 90_000 });
  await expect(page.getByText(/from your first attempt \(62\)/)).toBeVisible();
  await expect(page.getByText("Attempt 3")).toBeVisible();
  await expect(page.getByText("Not recorded").first()).toBeVisible();

  // daily usage went 2 → 3; History shows the new latest score
  const c = await control(page);
  const st = await c.snapshot();
  expect(st.usageEvents.length).toBe(4); // 2 seeded + the second deck upload + this retake
  await page.goto("/history");
  await expect(page.getByTestId("deck-row").first()).toContainText("3 attempts");
});
