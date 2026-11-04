import { expect, test } from "./fixtures";
import { seed } from "./helpers";

test("16. admin Diagnosis: run a preset, see sent / expected / actual, a failure with its reason, a custom input, run all, history", async ({ page }) => {
  test.setTimeout(120_000);
  await seed(page, "admin", { latencyMs: 0 });
  await page.goto("/admin");
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Diagnosis" }).click();
  await expect(page).toHaveURL(/\/admin\/diagnosis/);
  await expect(page.getByRole("heading", { level: 1, name: "Diagnosis" })).toBeVisible();
  await expect(page.getByText("These are real calls")).toBeVisible();

  // preset: Gemini
  const gem = page.getByRole("region", { name: "Slide reading · Gemini" });
  await expect(gem).toContainText("Not run");
  await gem.getByRole("button", { name: "Run preset test" }).click();
  const res = gem.getByTestId("result-gemini_slide");
  await expect(res).toContainText("Pass");
  await expect(res).toContainText("Sent");
  await expect(res).toContainText("Expected");
  await expect(res).toContainText("Actual");
  await expect(res).toContainText("HTTP");
  await expect(res).toContainText("••••••••");
  await expect(res.getByRole("list", { name: "Checks" })).toContainText("answered");

  // a model that does not exist: the failure and its reason are shown
  await gem.getByLabel("Model (optional)").fill("retired-flash");
  await gem.getByRole("button", { name: "Run preset test" }).click();
  await expect(res).toContainText("Fail");
  await expect(res).toContainText("does not know this model (HTTP 404)");
  await expect(res).toContainText("Message from the service: models/retired-flash");
  await expect(res.getByRole("alert")).toBeVisible();

  // a key slot that is not set
  await gem.getByLabel("Model (optional)").fill("");
  await gem.getByLabel("Key to test").selectOption("fallback_2");
  await gem.getByRole("button", { name: "Run preset test" }).click();
  await expect(res).toContainText("The fallback_2 key is not configured");

  // own input with an expectation
  const rep = page.getByRole("region", { name: "Report writing · NVIDIA" });
  await rep.getByRole("button", { name: "Send my own input" }).click();
  await rep.getByLabel("Your prompt").fill("Say hello");
  await rep.getByLabel("Answer should contain (optional)").fill("hello");
  await rep.getByRole("button", { name: "Send", exact: true }).click();
  await expect(rep.getByTestId("result-nvidia_report")).toContainText("Pass");
  await rep.getByLabel("Answer should contain (optional)").fill("zebra");
  await rep.getByRole("button", { name: "Send", exact: true }).click();
  await expect(rep.getByTestId("result-nvidia_report")).toContainText("Fail");
  await rep.getByLabel("Answer should contain (optional)").fill("");
  await rep.getByRole("button", { name: "Send", exact: true }).click();
  await expect(rep.getByTestId("result-nvidia_report")).toContainText("Answered, not checked");

  // run all: every service gets a result and the summary counts them
  await page.getByRole("button", { name: "Run all presets" }).click();
  await expect(page.getByText(/\d of 5 passed/)).toBeVisible({ timeout: 30_000 });
  for (const t of ["gemini_slide", "nvidia_report", "nvidia_asr", "storage", "database"]) await expect(page.getByTestId(`result-${t}`)).toBeVisible();

  // history is kept (this browser only) and can be cleared
  const hist = page.getByRole("region", { name: "Recent runs" });
  await expect(hist.getByRole("row")).not.toHaveCount(1);
  await hist.getByRole("button", { name: "Clear" }).click();
  await expect(hist).toContainText("Nothing yet");
});

test("16b. a student cannot open the Diagnosis page", async ({ page }) => {
  await seed(page, "returning_student", { latencyMs: 0 });
  await page.goto("/admin/diagnosis");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
});
