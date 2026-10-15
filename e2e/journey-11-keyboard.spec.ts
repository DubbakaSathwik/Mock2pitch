import { expect, test } from "./fixtures";
import { micGate, seed } from "./helpers";

test("11. keyboard-only: the practice-room controls work without a mouse and are labelled and visibly focused", async ({ page }) => {
  test.setTimeout(150_000);
  await seed(page, "returning_student", { stageMs: 150 });
  await micGate(page, false);
  await page.goto("/history");
  await page.getByRole("link", { name: "ParkSense hackathon pitch" }).click();
  await page.getByRole("button", { name: "Practice again" }).click();
  await page.getByRole("button", { name: "Continue to mic check" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  await expect(page.getByRole("button", { name: "Record", exact: true })).toBeVisible();

  // every control has an accessible name
  for (const n of ["Previous slide", "Record", "Stop", "Play back", "Re-record", "Next slide", "End session"]) await expect(page.getByRole("button", { name: n, exact: true })).toBeVisible();

  // Space records and stops; arrow keys move between slides
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Space");
  await expect(page.getByText("Recording slide 1").first()).toBeVisible();
  await page.waitForTimeout(2200);
  await page.keyboard.press("Space");
  await expect(page.getByText("Recorded").first()).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText(/Slide 2 of 8/)).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText(/Slide 1 of 8/)).toBeVisible();

  // Tab reaches the controls in order with a visible focus ring; Enter activates Play back, then Next
  const play = page.getByRole("button", { name: "Play back", exact: true });
  await play.focus();
  const ring = await play.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Playing back slide 1")).toBeVisible();
  await page.keyboard.press("Tab"); // Re-record
  await expect(page.getByRole("button", { name: "Re-record", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); // Next slide
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Slide 2 of 8/)).toBeVisible();
  // the dialog is keyboard-operable and Escape closes it
  await page.getByRole("button", { name: "End session" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Leave this session?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "End session" })).toBeFocused();
});
