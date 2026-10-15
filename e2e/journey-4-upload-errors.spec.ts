import { expect, test } from "./fixtures";
import { control, fixture, seed } from "./helpers";

test.describe("4. upload errors render below the dropzone", () => {
  test.beforeEach(async ({ page }) => { await seed(page, "student", { stageMs: 150 }); await page.goto("/practice/new"); });
  const err = (page: import("@playwright/test").Page) => page.getByTestId("upload-error");

  test("not a PDF", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("not-a-pdf.txt"));
    await expect(err(page)).toContainText("That file isn't a PDF");
    // the error sits below the dropzone, not above it
    const [drop, e] = await Promise.all([page.getByTestId("dropzone").boundingBox(), err(page).boundingBox()]);
    expect(e!.y).toBeGreaterThan(drop!.y + drop!.height - 1);
  });

  test("larger than 5 MB", async ({ page }) => {
    const big = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(5 * 1024 * 1024 + 1 - 9, 0x20)]);
    expect(big.length).toBe(5 * 1024 * 1024 + 1);
    await page.getByTestId("file-input").setInputFiles({ name: "big.pdf", mimeType: "application/pdf", buffer: big });
    await expect(err(page)).toContainText("That PDF is larger than 5 MB");
  });

  test("11 slides", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("deck-11.pdf"));
    await expect(err(page)).toContainText("That deck has 11 slides");
    await expect(err(page)).toContainText("Decks can have up to 10 slides");
  });

  test("encrypted and corrupt PDFs", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles(fixture("encrypted.pdf"));
    await expect(err(page)).toContainText("We couldn't open this PDF");
    await expect(err(page)).toContainText("password");
    await page.getByTestId("file-input").setInputFiles(fixture("corrupt.pdf"));
    await expect(err(page)).toContainText("We couldn't open this PDF");
    await expect(err(page)).toContainText("damaged");
  });

  test("upload failure → Try again succeeds", async ({ page }) => {
    const c = await control(page);
    await c.failNextPuts(1);
    await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
    await expect(err(page)).toContainText("Upload failed");
    await err(page).getByRole("button", { name: "Try again" }).click();
    await expect(page).toHaveURL(/\/reading|\/prepare/, { timeout: 60_000 });
  });

  test("a failed upload does not consume a daily session; success consumes one", async ({ page }) => {
    const c = await control(page);
    await page.getByTestId("file-input").setInputFiles(fixture("encrypted.pdf"));
    await expect(err(page)).toBeVisible();
    expect((await c.snapshot()).usageEvents.length).toBe(0);
    await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
    await expect(page).toHaveURL(/\/prepare/, { timeout: 60_000 });
    expect((await c.snapshot()).usageEvents.length).toBe(1);
  });
});

test("4b. daily limit → S18, from the dashboard and from a direct upload", async ({ page }) => {
  await seed(page, "at_limit");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Start a new practice" }).first().click();
  await expect(page).toHaveURL(/\/limit/);
  await expect(page.getByRole("heading", { level: 1, name: "That's 5 sessions today. Time to rest." })).toBeVisible();
  await expect(page.getByText(/Your limit resets at midnight IST, in about \d+ (hours|minutes?)|in about an hour/)).toBeVisible();
  await expect(page.getByText("5 of 5 sessions used")).toBeVisible();
  await page.goto("/practice/new");
  await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
  await expect(page).toHaveURL(/\/limit/);
});
