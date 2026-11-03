import { expect, test } from "./fixtures";
import { micGate, seed } from "./helpers";

async function toRoom(page: import("@playwright/test").Page) {
  await page.addInitScript(() => { try { localStorage.setItem("m2p.room.notes", "1"); } catch { /* ignore */ } });
  await page.goto("/history");
  await page.getByRole("link", { name: "ParkSense hackathon pitch" }).click();
  await page.getByRole("button", { name: "Practice again" }).click();
  await page.getByRole("button", { name: "Continue to mic check" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  await expect(page.getByRole("heading", { name: "Practice room", includeHidden: true })).toBeAttached();
}

test("14a. practice room: Key points / Script tabs in a fixed-size scrolling panel, and the slide strip is fully visible", async ({ page }) => {
  await seed(page, "returning_student", { latencyMs: 0 });
  await micGate(page, false);
  await toRoom(page);

  const panel = page.getByTestId("notes-panel");
  await expect(page.getByRole("tab", { name: "Key points" })).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("Cover on this slide");
  const keyBox = await page.locator("[class*=notes]").filter({ has: page.getByRole("tablist", { name: "Notes" }) }).first().boundingBox();

  await page.getByRole("tab", { name: "Script" }).click();
  await expect(page.getByRole("tab", { name: "Script" })).toHaveAttribute("aria-selected", "true");
  await expect(panel).toContainText("Suggested script");
  await expect(panel).toContainText("Good morning, everyone");
  const scriptBox = await page.locator("[class*=notes]").filter({ has: page.getByRole("tablist", { name: "Notes" }) }).first().boundingBox();
  expect(Math.round(scriptBox!.height)).toBe(Math.round(keyBox!.height)); // the panel keeps its size when the content changes

  // the choice is remembered, and the script follows the slide
  await page.reload();
  await expect(page.getByRole("tab", { name: "Script" })).toHaveAttribute("aria-selected", "true");

  // the slide thumbnails above the call buttons are fully on screen, not squeezed out or covered
  const chip = page.getByRole("button", { name: /^Slide 1,/ });
  const vp = page.viewportSize()!;
  const cb = (await chip.boundingBox())!;
  expect(cb.height).toBeGreaterThan(50);
  expect(cb.y).toBeGreaterThanOrEqual(0);
  expect(cb.y + cb.height).toBeLessThanOrEqual(vp.height);
  const dock = (await page.getByRole("group", { name: "Recording controls" }).boundingBox())!;
  if (vp.width >= 760) expect(cb.y + cb.height).toBeLessThanOrEqual(dock.y + 1); // above the dock, not under it
  // the slide itself never pushes the strip away
  const slide = (await page.getByTestId("slide-view").first().boundingBox())!;
  expect(slide.y + slide.height).toBeLessThanOrEqual(cb.y + 1);
});
