import { expect, test } from "./fixtures";
import { control, seed } from "./helpers";

test("9. admin: owner sign in → overview, students (block/unblock), detail, ratings, AI usage, terms publish; redirects", async ({ page, isMobile }) => {
  // desktop shows a table (rows); the compact layout shows one card per student (list items)
  const student = (n: RegExp) => page.getByRole(isMobile ? "listitem" : "row").filter({ hasText: n });
  await seed(page, "signed_out");
  await page.goto("/admin/sign-in");
  await expect(page.getByRole("heading", { level: 1, name: "Owner sign in" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // A1
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  for (const l of ["Total students", "Practice sessions", "Avg report rating", "AI credits used"]) await expect(page.getByLabel(l)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sessions per day" })).toBeVisible();
  await expect(page.getByText("Recent ratings")).toBeVisible();
  const bars = page.getByRole("table").first();
  await expect(bars.locator("tbody tr")).toHaveCount(14);

  // A2
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Students" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Students" })).toBeVisible();
  await page.getByLabel("Search students").fill("arjun");
  await expect(student(/Arjun Reddy/)).toBeVisible();
  await expect(student(/Ananya Rao/)).toHaveCount(0);
  await page.getByRole("button", { name: "Block Arjun Reddy" }).click();
  await expect(page.getByText("Student blocked")).toBeVisible();
  await expect(student(/Arjun Reddy/).getByText("Blocked")).toBeVisible();
  await page.getByRole("button", { name: "Unblock Arjun Reddy" }).click();
  await expect(page.getByText("Student unblocked")).toBeVisible();
  await page.getByLabel("Search students").fill("zzz-nobody");
  await expect(page.getByText(/No students match/)).toBeVisible();
  await page.getByLabel("Search students").fill("ananya");

  // A3
  await page.getByRole("link", { name: "View Ananya Rao" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Ananya Rao/ })).toBeVisible();
  await expect(page.getByLabel("Practice attempts")).toContainText("ParkSense hackathon pitch");
  await expect(page.getByLabel("Ratings given")).toContainText("per-slide breakdown");
  await page.getByRole("link", { name: "Students" }).first().click();
  await page.getByLabel("Search students").fill("vikram");
  await page.getByRole("link", { name: "View Vikram Singh" }).click();
  await expect(page.getByText("No attempts yet.")).toBeVisible();
  await expect(page.getByText("No ratings given.")).toBeVisible();

  // A4
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Ratings" }).click();
  await expect(page.getByText("average of 8 shown")).toBeVisible();
  await page.getByRole("tab", { name: "5 stars" }).click();
  await expect(page.locator("li", { hasText: "Ananya Rao" })).toBeVisible();
  await expect(page.locator("li", { hasText: "Arjun Reddy" })).toHaveCount(0);
  await page.getByRole("tab", { name: "1 stars" }).click();
  await expect(page.getByText("No ratings with that value.")).toBeVisible();

  // A5: 3 cards × 3 key slots
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "AI usage" }).click();
  for (const t of ["Slide reading", "Speech to text", "Report analysis"]) await expect(page.getByRole("region", { name: t })).toBeVisible();
  await expect(page.locator('[data-testid^="slot-"]')).toHaveCount(9);
  await expect(page.getByTestId("slot-speech_to_text-primary")).toContainText("Running low");
  await expect(page.getByTestId("slot-report_generation-fallback_1")).toContainText("Cooling down");
  await expect(page.getByTestId("slot-slide_reading-fallback_2")).toContainText("Not configured");
  await expect(page.getByTestId("slot-slide_reading-primary")).toContainText("••••••••7c2e");
  await expect(page.getByText("Credits used per day", { exact: true })).toHaveCount(3);

  // A6: edit, publish with label validation
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Terms" }).click();
  await expect(page.getByText("Version history")).toBeVisible();
  const publish = page.getByRole("button", { name: "Publish new version" });
  await expect(publish).toBeDisabled();
  const area = page.getByLabel("Terms text");
  await area.fill((await area.inputValue()) + "\n\n## 7. Extra\nA new clause.");
  await expect(publish).toBeEnabled();
  await publish.click();
  const dlg = page.getByRole("dialog", { name: "Publish a new version?" });
  await expect(dlg.getByLabel("Version label")).toHaveValue("v4.0");
  await dlg.getByLabel("Version label").fill("v3.0");
  await dlg.getByRole("button", { name: "Publish" }).click();
  await expect(dlg.getByText("The label must come after v3.0")).toBeVisible();
  await dlg.getByLabel("Version label").fill("four");
  await dlg.getByRole("button", { name: "Publish" }).click();
  await expect(dlg.getByText("Use a label like v4.0")).toBeVisible();
  await dlg.getByLabel("Version label").fill("v4.0");
  await dlg.getByLabel("Note (optional)").fill("Added a clause");
  await dlg.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("New version published. Students must re-accept.")).toBeVisible();
  await expect(page.getByText("v4.0").first()).toBeVisible();
  const c = await control(page);
  expect((await c.snapshot()).policies.at(-1).version_label).toBe("v4.0");

  // unsaved-changes guard
  await area.fill((await area.inputValue()) + " more");
  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Students" }).click();
  await expect(page.getByRole("dialog", { name: "Discard unpublished changes?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(/\/admin\/terms/);
});

test("9b. role redirects: admin → /admin, student → /dashboard", async ({ page, context }) => {
  await seed(page, "admin");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/admin$/);
  const p2 = await context.newPage();
  await p2.addInitScript(() => { sessionStorage.setItem("m2p.mock.seed", "student"); sessionStorage.setItem("m2p.mock.config", JSON.stringify({ latencyMs: 0, stageMs: 100 })); });
  await p2.goto("/admin/students");
  await expect(p2).toHaveURL(/\/dashboard/);
});
