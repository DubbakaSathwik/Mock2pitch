import { expect, test } from "./fixtures";
import { control, micGate, seed } from "./helpers";

test("5. policy republished while in the room: finish and submit uninterrupted; next navigation → Terms updated → accept → continues", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "returning_student", { stageMs: 200 });
  await micGate(page, false);
  await page.goto("/history");
  await page.getByRole("link", { name: "ParkSense hackathon pitch" }).click();
  await page.getByRole("button", { name: "Practice again" }).click();
  await page.getByRole("button", { name: "Continue to mic check" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  await expect(page).toHaveURL(/\/room/);

  const c = await control(page);
  await c.republishPolicy(); // the owner publishes a new version while the student is in the room
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Review and submit" }).first().click();
  await expect(page).toHaveURL(/\/review/);
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await page.getByRole("button", { name: "Submit anyway" }).click();
  // the session is analysed without any policy interruption (analysing is exempt) ...
  await expect.poll(async () => (await c.snapshot()).reports.length, { timeout: 60_000 }).toBe(3);

  // analysis finishes → the report is a normal screen, so the updated terms gate appears
  await expect(page).toHaveURL(/\/onboarding\/terms/, { timeout: 90_000 });
  await expect(page.getByText("We've updated our terms")).toBeVisible();
  await expect(page.getByText(/New version v3\.1/)).toBeVisible();
  await page.getByLabel("I have read and agree to the Terms and the Privacy Policy").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/reports\//);
  await expect(page.getByText("Attempt 3")).toBeVisible();
});
