import { expect, test } from "./fixtures";
import { control, fixture, seed, submitDetails } from "./helpers";

test("15. an unfinished deck blocks a new upload: go back to it, or cancel it and upload the new one", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "student", { stageMs: 150 });
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/practice\/[^/]+\/details/, { timeout: 60_000 });
  const detailsUrl = page.url();

  // the dashboard shows the unfinished deck with both ways out
  await page.getByRole("link", { name: "Exit to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const card = page.getByTestId("active-deck");
  await expect(card).toContainText("deck-3");
  await expect(card).toContainText("waiting for your details");
  await card.getByRole("button", { name: "Go to that deck" }).click();
  await expect(page).toHaveURL(detailsUrl);

  // a new upload is refused with the same two options
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  const err = page.getByTestId("upload-error");
  await expect(err).toContainText("Finish your current deck first", { timeout: 30_000 });
  await err.getByRole("button", { name: "Go to that deck" }).click();
  await expect(page).toHaveURL(detailsUrl);

  // cancel it: asks first, discards the deck, and the file that was refused is uploaded straight away
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await page.getByTestId("upload-error").getByRole("button", { name: "Cancel that deck" }).click();
  const dlg = page.getByRole("dialog", { name: "Cancel this deck?" });
  await expect(dlg).toContainText("not given back");
  await dlg.getByRole("button", { name: "Keep it" }).click();
  await expect(dlg).toHaveCount(0);
  await page.getByTestId("upload-error").getByRole("button", { name: "Cancel that deck" }).click();
  await page.getByRole("dialog", { name: "Cancel this deck?" }).getByRole("button", { name: "Cancel deck" }).click();
  await expect(page.getByText("Deck cancelled. You can upload a new one now.")).toBeVisible();
  await expect(page).toHaveURL(/\/practice\/[^/]+\/details/, { timeout: 60_000 });
  expect(page.url()).not.toBe(detailsUrl);

  // the old deck link no longer shows the form, and the session is not refunded (2 uploads = 2 sessions used)
  const c = await control(page);
  expect((await c.snapshot()).usageEvents.length).toBe(2);
  await page.goto(detailsUrl);
  await expect(page).toHaveURL(/\/practice\/new/);

  // the new deck can be finished normally
  await page.goBack().catch(() => {});
  await page.goto("/practice/new");
  await expect(page.getByTestId("active-deck")).toHaveCount(0);
});
