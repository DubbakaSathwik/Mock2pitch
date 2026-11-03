import { expect, test } from "./fixtures";
import { control, fixture, seed } from "./helpers";

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

test("13a. Details step: required fields, 'Others' text, the 50-word limit, then the slides are read for that audience", async ({ page }) => {
  test.setTimeout(180_000);
  await seed(page, "student", { stageMs: 150 });
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/practice\/[^/]+\/details/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "About your presentation" })).toBeVisible();
  await expect(page.getByTestId("back-link")).toHaveAttribute("href", "/practice/new");

  // only audience and time are required; the free-text box appears for "Others" and must be filled
  await expect(page.getByLabel("Describe your audience")).toHaveCount(0);
  await page.getByLabel("Who are you presenting to?").selectOption("others");
  await page.getByRole("button", { name: "Read my slides" }).click();
  await expect(page.getByText("Tell us who you are presenting to")).toBeVisible();
  await page.getByLabel("Describe your audience").fill("Rotary club members");

  // summary: live word counter, hard limit of 50 words
  const abstract = page.getByLabel(/Short summary of your presentation/);
  await abstract.fill(words(51));
  await expect(page.getByText("51 / 50 words")).toBeVisible();
  await page.getByRole("button", { name: "Read my slides" }).click();
  await expect(page.getByText("Keep it to 50 words or fewer")).toBeVisible();
  await abstract.fill("A parking app for campuses.");
  await expect(page.getByText("5 / 50 words")).toBeVisible();

  // time: 1-20 whole minutes; the presets fill the box
  await page.getByLabel("Total time (minutes)").fill("0");
  await page.getByRole("button", { name: "Read my slides" }).click();
  await expect(page.getByText("Enter at least 1 minute")).toBeVisible();
  await page.getByRole("tab", { name: "7 min" }).click();
  await expect(page.getByLabel("Total time (minutes)")).toHaveValue("7");

  await page.getByLabel(/Goal of your presentation/).fill("Win the seed round");
  await page.getByRole("button", { name: "Read my slides" }).click();
  await expect(page).toHaveURL(/\/(reading|prepare)/, { timeout: 60_000 }); // reading can be over before the check runs
  await expect(page).toHaveURL(/\/prepare/, { timeout: 60_000 });
  // slide 1 opens with the introduction, built from the summary the student typed (on a phone the script sits behind a tab)
  if ((page.viewportSize()?.width ?? 1280) < 760) await page.getByRole("tab", { name: "Script" }).click();
  await expect(page.getByLabel("Suggested script")).toContainText("Hello everyone", { timeout: 15_000 });
  await expect(page.getByLabel("Suggested script")).toContainText("A parking app for campuses");
  // the Time step starts from the chosen 7 minutes and can still be edited
  await page.getByRole("button", { name: "Continue to set time" }).first().click();
  await expect(page.getByLabel("Total duration (minutes)")).toHaveValue("7");
  await page.getByLabel("Total duration (minutes)").fill("4");
  await expect(page.getByLabel("Total duration (minutes)")).toHaveValue("4");
});

test("13b. a deck that is already read does not show the Details step; a deck still waiting does after a reload", async ({ page }) => {
  await seed(page, "returning_student", { stageMs: 100 });
  await page.goto("/practice/00000000-0000-4000-8000-00000000d001/details");
  await expect(page).toHaveURL(/\/practice\/00000000-0000-4000-8000-00000000d001\/prepare/);

  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/details/, { timeout: 60_000 });
  const c = await control(page);
  expect((await c.snapshot()).usageEvents.length).toBe(3); // 2 seeded + this upload; the Details step costs nothing more
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "About your presentation" })).toBeVisible();
});
