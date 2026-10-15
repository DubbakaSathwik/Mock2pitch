import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { axeCheck, control, fixture, micGate, seed } from "./helpers";

const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 760;

test("2. first practice: upload → reading → prep → time → mic → room → review → analysing → report → rate", async ({ page }) => {
  test.setTimeout(240_000);
  await seed(page, "student", { stageMs: 600 });
  await micGate(page, true);
  await page.goto("/practice/new");

  // S6 + S7
  await expect(page.getByRole("heading", { level: 1, name: "Upload your slides" })).toBeVisible();
  await expect(page.getByText("Using PowerPoint? Choose File → Save as PDF, then upload it here.")).toBeVisible();
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/practice\/[^/]+\/reading/, { timeout: 60_000 });
  await expect(page).toHaveURL(/\/practice\/[^/]+\/prepare/, { timeout: 60_000 });

  // S8: slides, key points + script
  await expect(page.getByRole("heading", { level: 1, name: "Prepare your slides" })).toBeVisible();
  await expect(page.getByTestId("slide-view").first()).toBeVisible();
  if (mobile(page)) {
    await page.getByRole("tab", { name: "Script" }).click();
    await expect(page.getByLabel("Suggested script")).toBeVisible();
    await page.getByRole("tab", { name: "Key points" }).click();
  }
  await expect(page.getByLabel("Key points")).toContainText("First key idea for this slide");
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: /^Slide 2/ }).first().click();
  await page.getByRole("button", { name: "Continue to set time" }).click();

  // S9: 0 and 21 are rejected, preset 5, then 1 minute (so the per-slide time is short enough to overrun in the test)
  await expect(page).toHaveURL(/\/time/);
  const input = page.getByLabel("Total duration (minutes)");
  await input.fill("0");
  await expect(page.getByText("Enter at least 1 minute")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue to mic check" })).toBeDisabled();
  await input.fill("21");
  await expect(page.getByText("The maximum is 20 minutes")).toBeVisible();
  await page.getByRole("tab", { name: "5 min" }).click();
  await expect(input).toHaveValue("5");
  await input.fill("1");
  await expect(page.getByText("Total 1:00")).toBeVisible();
  await page.getByRole("button", { name: "Continue to mic check" }).click();

  // S10: denied → fix → try again → granted (live meter)
  await expect(page).toHaveURL(/\/mic/);
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone access is blocked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter practice room" })).toBeDisabled();
  await page.evaluate(() => { (window as unknown as { __denyMic: boolean }).__denyMic = false; });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await expect(page.getByTestId("mic-meter").locator('[data-on="1"]').first()).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Enter practice room" }).click();

  // S11: slide 1 overruns (timer goes red), slide 2 recorded then re-recorded, slide 3 recorded
  await expect(page).toHaveURL(/\/room/);
  await expect(page.getByTestId("slide-view").first()).toBeVisible();
  const slideTimer = page.getByTestId("slide-timer");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page.getByText("Recording slide 1").first()).toBeVisible();
  await expect(page.getByTestId("self-tile")).toHaveAttribute("data-speaking", "true");
  await expect(slideTimer).toHaveAttribute("data-over", "true", { timeout: 40_000 });
  await expect(page.getByTestId("room-announce")).toContainText("Over the suggested time");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByText("Over time").first()).toBeVisible();
  await page.getByRole("button", { name: "Play back", exact: true }).click();
  await expect(page.getByText("Playing back slide 1")).toBeVisible();
  await page.getByRole("button", { name: "Next slide" }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Re-record" }).click();
  await expect(page.getByText("Recording slide 2").first()).toBeVisible();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Next slide" }).click();
  await page.keyboard.press("Space"); // keyboard shortcut starts recording
  await expect(page.getByText("Recording slide 3").first()).toBeVisible();
  await page.waitForTimeout(3000);
  await page.keyboard.press("Space");
  await expect(page.getByText("Recorded").first()).toBeVisible();

  // End → Keep practising
  await page.getByRole("button", { name: "End session" }).click();
  await expect(page.getByRole("dialog", { name: "Leave this session?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep practising" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Review and submit" }).first().click();

  // S12 → submit
  await expect(page).toHaveURL(/\/review/);
  await expect(page.getByText("Audio is deleted once your report is generated.")).toBeVisible();
  await page.getByRole("button", { name: "Submit for feedback" }).click();

  // S13 → S14
  await expect(page).toHaveURL(/\/analysing/, { timeout: 60_000 });
  await expect(page.getByTestId("analysis-stage")).toBeVisible();
  await expect(page).toHaveURL(/\/reports\//, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const subs = page.getByRole("list", { name: "Sub-scores" });
  for (const l of ["Timing", "Pacing", "Filler words", "Slide coverage", "Clarity"]) await expect(subs.getByText(l, { exact: true })).toBeVisible();
  await expect(subs).toContainText("For your information");
  await expect(subs).toContainText("wpm");
  await expect(page.getByTestId("filler-note")).toContainText("Short sounds like \u2018um\u2019 may not be picked up."); // Q4
  await expect(page.getByText("Top 3 things to fix next time")).toBeVisible();
  await expect(page.getByText("What you did well")).toBeVisible();

  // accordion + transcript, slide 3 has a clip, so open slide 2
  const row2 = page.getByRole("button", { name: /Solution/ });
  await row2.click();
  await expect(page.getByText("Transcript").first()).toBeVisible();
  await expect(page.getByText("Key points").first()).toBeVisible();
  await expect(page.getByTestId("filler-note-slide").first()).toContainText("We count words like"); // Q4

  // rate: exactly five star buttons
  await expect(page.getByRole("radio")).toHaveCount(5);
  await page.getByRole("radio", { name: "4 stars" }).click();
  await page.getByLabel("Comment (optional)").fill("Clear and useful");
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();

  // a11y on the report
  const a = await axeCheck(page, "report");
  expect(a.bad, JSON.stringify(a.bad, null, 1)).toEqual([]);
  // the mock inspection hook does not exist in production builds (E2E_PROD=1 runs this journey against `next start`)
  if (process.env.E2E_PROD) return;
  const c = await control(page);
  const st = await c.snapshot();
  expect(st.reports.length).toBe(1);
  expect(st.ratings[0].stars).toBe(4);
});
