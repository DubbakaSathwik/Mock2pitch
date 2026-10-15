import { expect, test } from "./fixtures";
import { control, fixture, micGate, seed } from "./helpers";

test("6a. AI busy while reading slides → Try again succeeds", async ({ page }) => {
  await seed(page, "student", { stageMs: 250 });
  await page.goto("/practice/new");
  const c = await control(page);
  await c.failNext({ kind: "deck-process", code: "ai_unavailable" });
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/reading/, { timeout: 60_000 });
  await expect(page.getByText("Our AI is busy right now")).toBeVisible({ timeout: 30_000 });
  expect((await c.snapshot()).usageEvents.length).toBe(1); // nothing extra charged
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/prepare/, { timeout: 60_000 });
  expect((await c.snapshot()).usageEvents.length).toBe(1);
});

async function recordOne(page: import("@playwright/test").Page, slide = 0) {
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  void slide;
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Review and submit" }).first().click();
}
async function startRetake(page: import("@playwright/test").Page) {
  await page.goto("/history");
  await page.getByRole("link", { name: "ParkSense hackathon pitch" }).click();
  await page.getByRole("button", { name: "Practice again" }).click();
  await page.getByRole("button", { name: "Continue to mic check" }).click();
}

test("6b. AI busy while analysing → Try again succeeds", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "returning_student", { stageMs: 200 });
  await micGate(page, false);
  await startRetake(page);
  await recordOne(page);
  const c = await control(page);
  await c.failNext({ kind: "session-analyse", code: "ai_unavailable" });
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await page.getByRole("button", { name: "Submit anyway" }).click();
  await expect(page.getByTestId("analysis-failed")).toContainText("Our AI is busy right now", { timeout: 60_000 });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/reports\//, { timeout: 90_000 });
  const st = await c.snapshot();
  expect(st.usageEvents.length).toBe(3); // 2 seeded + the retake; the retry charged nothing
});

test("6c. audio_invalid → back to Review, re-record that slide, submit again", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "returning_student", { stageMs: 200 });
  await micGate(page, false);
  await startRetake(page);
  await recordOne(page);
  const c = await control(page);
  await c.failNext({ kind: "session-analyse", code: "audio_invalid" });
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await page.getByRole("button", { name: "Submit anyway" }).click();
  await expect(page.getByTestId("submit-error")).toContainText("One recording couldn't be read");
  await page.getByRole("button", { name: /Re-record slide 1/ }).last().click();
  await expect(page).toHaveURL(/\/room\?slide=0/);
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Review and submit" }).first().click();
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await page.getByRole("button", { name: "Submit anyway" }).click();
  await expect(page).toHaveURL(/\/reports\//, { timeout: 90_000 });
});
