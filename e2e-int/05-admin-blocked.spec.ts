// Flows 5.7 + 5.9 on the real stack: the integration admin (never the real owner) blocks / unblocks student NEW through the admin UI, the
// student's reads keep working while every write is refused; the admin overview, students, ratings and AI usage pages show real data; the
// admin has no access to student content. Needs NEW's deck/report/rating from 02-onboarding-practice.
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { userApi } from "./support/api";
import { watchConsole } from "./support/console";
import { signedInContext } from "./support/session";

const ids = JSON.parse(fs.readFileSync(".integration-state.json", "utf8")) as { deckId: string; reportId: string; userNew: string };
test.describe.configure({ mode: "serial" });

test("admin: lands on /admin, never sees the student UI or the Terms gate; overview + students + ratings + AI usage show real data", async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const { ctx } = await signedInContext(browser, "ADMIN", baseURL!);
  const page = await ctx.newPage(); const con = watchConsole(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  for (const l of ["Total students", "Practice sessions", "Avg report rating", "AI credits used"]) await expect(page.getByLabel(l)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sessions per day" })).toBeVisible();
  await expect(page.getByRole("table").first().locator("tbody tr")).toHaveCount(14);

  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Students" }).click();
  await page.getByLabel("Search students").fill("it.new");
  await expect(page.getByRole("row", { name: /IT New Student/ })).toBeVisible();
  await page.getByLabel("Search students").fill("zzz-nobody-zzz");
  await expect(page.getByText(/No students match/)).toBeVisible();
  await page.getByLabel("Search students").fill("it.new");
  await page.getByRole("link", { name: "View IT New Student" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /IT New Student/ })).toBeVisible();
  await expect(page.getByLabel("Practice attempts")).toContainText(/Attempt [12]/);
  // summaries only: no slides, transcripts or feedback text on the admin detail page
  await expect(page.locator("main")).not.toContainText(/transcript|key point|suggested script/i);

  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Ratings" }).click();
  await expect(page.getByText(/average of \d+ shown/)).toBeVisible();
  await expect(page.locator("li", { hasText: "IT New Student" }).first()).toBeVisible();
  await page.getByRole("tab", { name: "5 stars" }).click();
  await expect(page.locator("li", { hasText: "IT New Student" })).toHaveCount(0);
  await page.getByRole("tab", { name: "4 stars" }).click();
  await expect(page.locator("li", { hasText: "IT New Student" }).first()).toBeVisible();

  await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "AI usage" }).click();
  for (const t of ["Slide reading", "Speech to text", "Report analysis"]) await expect(page.getByRole("region", { name: t })).toBeVisible();
  await expect(page.locator('[data-testid^="slot-"]')).toHaveCount(9);
  await expect(page.getByTestId("slot-slide_reading-primary")).toContainText("Configured");
  await expect(page.getByTestId("slot-slide_reading-fallback_1")).toContainText("Not configured");
  await expect(page.getByTestId("slot-slide_reading-primary")).toContainText(/••••/);
  expect(await page.locator("main").innerText()).not.toMatch(/nvapi-/); // keys are masked, never shown
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
  await ctx.close();
});

test("admin API: students list paginates with total_count and has no access to student content or practice", async () => {
  const a = await userApi("ADMIN");
  const p1 = await a.client.rpc("admin_list_students", { p_limit: 2, p_offset: 0 });
  const p2 = await a.client.rpc("admin_list_students", { p_limit: 2, p_offset: 2 });
  expect(p1.error).toBeNull();
  expect(p1.data).toHaveLength(2); expect(p1.data![0].total_count).toBeGreaterThanOrEqual(4);
  expect(p2.data![0].user_id).not.toBe(p1.data![0].user_id);
  expect(p1.data![0].total_count).toBe(p2.data![0].total_count);
  // most recently active first
  const times = (p1.data as { last_active_at: string | null }[]).map((r) => r.last_active_at ?? "");
  expect([...times].sort().reverse()).toEqual(times);
  for (const t of ["decks", "slides", "reports", "session_slide_results", "practice_sessions", "report_ratings", "usage_events"]) {
    const r = await a.client.from(t as never).select("*").limit(5);
    expect(r.data ?? [], `admin must not read ${t}`).toEqual([]);
  }
  const urls = await a.fn("asset-urls", { deck_id: ids.deckId, kinds: ["slide_image"] });
  expect(urls.error?.code).toBe("is_admin"); expect(urls.status).toBe(403);
  expect((await a.client.rpc("start_practice_session", { p_deck_id: ids.deckId, p_total_minutes: 5 })).error?.message).toBe("is_admin");
  expect((await a.fn("account-delete", { confirm: "DELETE" })).error?.code).toBe("is_admin");
  const blockSelf = await a.client.rpc("admin_set_blocked", { p_user_id: a.userId, p_blocked: true });
  expect(blockSelf.error?.message).toBe("cannot_block_admin");
});

test("block / unblock: reads keep working, every write is refused, UI shows the paused screen", async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const admin = await signedInContext(browser, "ADMIN", baseURL!);
  const ap = await admin.ctx.newPage();
  await ap.goto("/admin/students");
  await ap.getByLabel("Search students").fill("it.new");
  await ap.getByRole("button", { name: "Block IT New Student" }).click();
  await expect(ap.getByText("Student blocked")).toBeVisible();
  await expect(ap.getByRole("row", { name: /IT New Student/ }).getByText("Blocked")).toBeVisible();

  const stu = await signedInContext(browser, "NEW", baseURL!);
  const sp = await stu.ctx.newPage(); const con = watchConsole(sp, [/Failed to load resource: the server responded with a status of (400|403)/]);
  await sp.goto("/dashboard");
  await expect(sp).toHaveURL(/\/paused/, { timeout: 60_000 });
  await expect(sp.getByRole("heading", { level: 1, name: "Your account is paused" })).toBeVisible();
  await sp.goto("/practice/new");
  await expect(sp).toHaveURL(/\/paused/);
  // reads still work
  await sp.goto("/history");
  await expect(sp.getByTestId("deck-row")).toHaveCount(1);
  await sp.goto(`/reports/${ids.reportId}`);
  await expect(sp.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(sp.getByRole("button", { name: "Retake this presentation" })).toBeDisabled();
  // writes are refused by the backend
  const api = await userApi("NEW");
  expect((await api.fn("deck-upload-init", { filename: "a.pdf", size_bytes: 100, content_type: "application/pdf" })).error?.code).toBe("blocked");
  expect((await api.client.rpc("set_deck_pinned", { p_deck_id: ids.deckId, p_pinned: true })).error?.message).toBe("blocked");
  expect((await api.client.rpc("start_practice_session", { p_deck_id: ids.deckId, p_total_minutes: 5 })).error?.message).toBe("blocked");
  expect((await api.client.rpc("rate_report", { p_report_id: ids.reportId, p_stars: 3 })).error?.message).toMatch(/blocked|already_rated/);
  const upd = await api.client.from("profiles").update({ college: "x" }).eq("id", api.userId).select();
  expect(upd.data ?? []).toHaveLength(0);
  expect((await api.client.from("decks").select("id")).data).toHaveLength(1);

  // unblock restores everything
  await ap.getByRole("button", { name: "Unblock IT New Student" }).click();
  await expect(ap.getByText("Student unblocked")).toBeVisible();
  await sp.goto("/dashboard");
  await expect(sp).toHaveURL(/\/dashboard/);
  await expect(sp.getByRole("heading", { level: 1, name: /ready to rehearse/ })).toBeVisible();
  expect((await api.client.rpc("set_deck_pinned", { p_deck_id: ids.deckId, p_pinned: false })).error).toBeNull();
  void con;
  await admin.ctx.close(); await stu.ctx.close();
});
