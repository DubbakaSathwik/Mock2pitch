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

  const vp = page.viewportSize()!;
  const slide = (await page.getByTestId("slide-view").first().boundingBox())!;
  if (vp.width >= 760) {
    // laptop: the slide thumbnails above the call buttons are fully on screen, not squeezed out or covered
    const chip = page.getByRole("button", { name: /^Slide 1,/ });
    const cb = (await chip.boundingBox())!;
    expect(cb.height).toBeGreaterThan(50);
    expect(cb.y).toBeGreaterThanOrEqual(0);
    expect(cb.y + cb.height).toBeLessThanOrEqual(vp.height);
    const dock = (await page.getByRole("group", { name: "Recording controls" }).boundingBox())!;
    expect(cb.y + cb.height).toBeLessThanOrEqual(dock.y + 1); // above the dock, not under it
    expect(slide.y + slide.height).toBeLessThanOrEqual(cb.y + 1); // the slide never pushes the strip away
    await expect(page.getByTestId("jury-tile")).toHaveCount(5);
  } else {
    // phone: no thumbnail strip; a 2 x 2 grid below the slide with three jury members and you
    await expect(page.getByRole("group", { name: "Slides" })).toHaveCount(0);
    await expect(page.getByTestId("jury-tile")).toHaveCount(3);
    await expect(page.getByTestId("self-tile")).toHaveCount(1);
    const tiles = await Promise.all([...Array(3).keys()].map((k) => page.getByTestId("jury-tile").nth(k).boundingBox()));
    const me = (await page.getByTestId("self-tile").boundingBox())!;
    expect(tiles[0]!.y).toBeGreaterThanOrEqual(slide.y + slide.height);
    expect(Math.abs(tiles[0]!.y - tiles[1]!.y)).toBeLessThan(2); // two per row
    expect(tiles[2]!.y).toBeGreaterThan(tiles[0]!.y + tiles[0]!.height - 2);
    expect(Math.abs(me.y - tiles[2]!.y)).toBeLessThan(2);
    expect(tiles[0]!.height).toBeGreaterThan(90); // big enough to see
  }
});

test("14b. phone: swipe the slide left / right to change slide; short or mostly vertical drags do not", async ({ page }) => {
  await seed(page, "returning_student", { latencyMs: 0 });
  await micGate(page, false);
  await toRoom(page);
  const vp = page.viewportSize()!;
  test.skip(vp.width >= 760, "swipe is the phone interaction");
  const title = page.getByText(/^Slide \d+\/8$/);
  await expect(title).toHaveText("Slide 1/8");
  const box = (await page.getByTestId("slide-view").first().boundingBox())!;
  const y = box.y + box.height / 2, x = box.x + box.width / 2;
  const drag = async (dx: number, dy = 0) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 }); await page.mouse.move(x + dx, y + dy, { steps: 3 }); await page.mouse.up(); };
  await drag(-30); await expect(title).toHaveText("Slide 1/8"); // too short
  await drag(-60, 120); await expect(title).toHaveText("Slide 1/8"); // mostly vertical
  await drag(-140); await expect(title).toHaveText("Slide 2/8"); // swipe left = next
  await drag(-140); await expect(title).toHaveText("Slide 3/8");
  await drag(140); await expect(title).toHaveText("Slide 2/8"); // swipe right = previous
  await drag(140); await expect(title).toHaveText("Slide 1/8");
  await drag(140); await expect(title).toHaveText("Slide 1/8"); // no slide before the first
  await expect(page.getByTestId("slide-dots").locator("i")).toHaveCount(8);
});
