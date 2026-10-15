// Flows 5.1 – 5.4 on the real stack (desktop): onboarding → upload → reading (Realtime) → prepare (R2 images) → time → mic → room → review →
// submit → analysing (Realtime) → report → rate → retake → history / pin / deck detail. One user (NEW), 2 complete analyses.
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { watchConsole } from "./support/console";
import { watchRealtime } from "./support/realtime";
import { signedInContext } from "./support/session";

const fixture = (n: string) => path.resolve("tests/fixtures", n);
const ids: Record<string, unknown> = {};
const save = () => fs.writeFileSync("test-results/it-ids.json", JSON.stringify(ids, null, 2));
const t0 = Date.now();
const mark = (k: string) => { (ids.timings as Record<string, number>)[k] = Math.round((Date.now() - t0) / 100) / 10; save(); };
ids.timings = {};

test.describe.configure({ mode: "serial" });

let page: Page;
let client: Awaited<ReturnType<typeof signedInContext>>["client"];
let userId = "";
let con: ReturnType<typeof watchConsole>;
let rt: ReturnType<typeof watchRealtime>;
let deckId = "";

test.beforeAll(async ({ browser, baseURL }) => {
  fs.mkdirSync("test-results", { recursive: true });
  const s = await signedInContext(browser, "NEW", baseURL!);
  client = s.client; userId = s.userId;
  page = await s.ctx.newPage();
  con = watchConsole(page); rt = watchRealtime(page);
  ids.userNew = userId;
});
test.afterAll(async () => { ids.realtime = rt; save(); await page.context().close(); });

test("5.1 onboarding: Terms (first time) → Profile → empty dashboard; rows written", async () => {
  // re-runnable while debugging: a user that already finished onboarding (deck exists) skips this step
  const { data: already } = await client.from("profiles").select("profile_completed_at").eq("id", userId).single();
  test.skip(!!already?.profile_completed_at, "NEW user is already onboarded (re-run)");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/onboarding\/terms/, { timeout: 60_000 }); // policy gate comes first
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  const cont = page.getByRole("button", { name: "Continue" });
  await expect(cont).toBeDisabled();
  await page.getByLabel("I have read and agree to the Terms and the Privacy Policy").check();
  await cont.click();
  await expect(page).toHaveURL(/\/onboarding\/profile/);
  // DB: the acceptance row is for the latest policy version
  const { data: acc } = await client.from("policy_acceptances").select("policy_version_id");
  const { data: latest } = await client.from("policy_versions").select("id,version_label").order("published_at", { ascending: false }).limit(1).single();
  expect(acc?.map((a) => a.policy_version_id)).toEqual([latest!.id]);
  ids.policyVersion = latest!.version_label;

  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page.getByText("Enter your college name")).toBeVisible();
  await page.getByLabel("College").fill("IT Test College");
  await page.getByLabel("Year").selectOption("4th year");
  await page.getByLabel("Branch").selectOption("ECE");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Your first practice starts here")).toBeVisible();
  await expect(page.getByText("0 of 5 sessions")).toBeVisible();
  const { data: prof } = await client.from("profiles").select("college,year,branch,profile_completed_at").eq("id", userId).single();
  expect(prof).toMatchObject({ college: "IT Test College", year: "4th year", branch: "ECE" });
  expect(prof!.profile_completed_at).not.toBeNull();
  mark("onboarded");
});

test("5.2 upload → reading (Realtime) → prepare (real images from R2)", async () => {
  const { data: existing } = await client.from("decks").select("id,status").eq("status", "ready").limit(1);
  const tUp = Date.now();
  if (existing?.length) {
    deckId = existing[0]!.id; ids.deckId = deckId; ids.reusedDeck = true; save(); // re-run: reuse the deck (each upload consumes a daily session and AI credits)
    await page.goto(`/practice/${deckId}/prepare`);
  } else {
    await page.goto("/practice/new");
    await expect(page.getByRole("heading", { level: 1, name: "Upload your slides" })).toBeVisible();
    await page.getByTestId("file-input").setInputFiles(fixture("deck-3.pdf"));
    await expect(page).toHaveURL(/\/practice\/[^/]+\/reading/, { timeout: 120_000 });
    deckId = page.url().match(/practice\/([^/]+)\/reading/)![1]!;
    ids.deckId = deckId; save();
    const { data: usage } = await client.from("usage_events").select("id"); // consumed on the validated upload
    expect(usage).toHaveLength(1);
    // reading stage strings (from Realtime; polling is only a fallback)
    const stages = new Set<string>();
    const t1 = Date.now();
    while (!/\/prepare/.test(page.url()) && Date.now() - t1 < 120_000) {
      const txt = await page.locator("main").innerText().catch(() => "");
      for (const m of txt.matchAll(/(Waiting for slide images|Reading slide \d+ of \d+)/g)) stages.add(m[1]!);
      await page.waitForTimeout(250);
    }
    ids.readingStages = [...stages];
    ids.uploadToReadyMs = Date.now() - tUp;
  }
  await expect(page).toHaveURL(/\/practice\/[^/]+\/prepare/, { timeout: 30_000 });
  mark("upload_to_prepare");

  // DB state
  const { data: deck } = await client.from("decks").select("status,page_count,processed_slides,processing_stage,error_code,title").eq("id", deckId).single();
  expect(deck).toMatchObject({ status: "ready", page_count: 3, processed_slides: 3, error_code: null });
  const { data: files } = await client.from("files").select("kind,status,mime_type,size_bytes,slide_index").eq("deck_id", deckId).order("slide_index");
  const pdf = files!.find((f) => f.kind === "deck_pdf")!;
  expect(pdf).toMatchObject({ status: "uploaded", mime_type: "application/pdf" });
  const imgs = files!.filter((f) => f.kind === "slide_image");
  expect(imgs).toHaveLength(3);
  for (const i of imgs) { expect(i.status).toBe("uploaded"); expect(i.mime_type).toBe("image/jpeg"); expect(i.size_bytes!).toBeLessThanOrEqual(1_000_000); }
  const { data: slides } = await client.from("slides").select("slide_index,title,key_points,suggested_script,time_weight").eq("deck_id", deckId).order("slide_index");
  expect(slides).toHaveLength(3);
  for (const s of slides!) { expect(s.key_points.length).toBeGreaterThan(0); expect((s.suggested_script ?? "").length).toBeGreaterThan(10); expect(s.time_weight).toBeGreaterThan(0); }

  // S8 shows the real images (signed GET from R2, CORS ok) and the AI key points
  await expect(page.getByRole("heading", { level: 1, name: "Prepare your slides" })).toBeVisible();
  const img = page.getByTestId("slide-view").first().locator("img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth)).toBeGreaterThan(300);
  await expect(page.getByLabel("Key points")).toContainText(slides![0]!.key_points[0]!.slice(0, 12));
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
});

let sessionId = "";
let reportId = "";

async function ensureDeck() {
  if (deckId) return;
  const { data } = await client.from("decks").select("id").eq("status", "ready").limit(1).single(); // when a single test is run with -g
  deckId = data!.id;
}

test("5.3 time → mic → room (real MediaRecorder) → review → submit → analysing (Realtime) → report", async () => {
  await ensureDeck();
  await page.goto(`/practice/${deckId}/time`);
  await expect(page.getByRole("heading", { level: 1, name: "Set your time" })).toBeVisible();
  await page.getByRole("tab", { name: "5 min" }).click();
  await page.getByRole("button", { name: "Continue to mic check" }).click();
  await expect(page).toHaveURL(/\/session\/[^/]+\/mic/);
  sessionId = page.url().match(/session\/([^/]+)\/mic/)![1]!;
  ids.sessionId = sessionId; save();
  const { data: sess } = await client.from("practice_sessions").select("status,attempt_number,total_minutes,suggested_seconds").eq("id", sessionId).single();
  expect(sess).toMatchObject({ status: "in_progress", attempt_number: 1, total_minutes: 5 });
  expect(sess!.suggested_seconds).toHaveLength(3);
  expect(sess!.suggested_seconds.reduce((a: number, b: number) => a + b, 0)).toBeGreaterThan(280); // AI weights split 5 minutes
  const { data: usage0 } = await client.from("usage_events").select("id");
  expect(usage0).toHaveLength(1); // the first attempt is covered by the upload

  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  await expect(page).toHaveURL(/\/room/);
  for (let i = 1; i <= 3; i++) {
    await page.getByRole("button", { name: "Record", exact: true }).click();
    await expect(page.getByText(`Recording slide ${i}`).first()).toBeVisible();
    await page.waitForTimeout(5500);
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    if (i < 3) await page.getByRole("button", { name: "Next slide" }).click();
  }
  await page.getByRole("button", { name: "Review and submit" }).first().click();
  await expect(page).toHaveURL(/\/review/);
  await expect(page.getByText("Audio is deleted once your report is generated.")).toBeVisible();

  const tSubmit = Date.now();
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await expect(page).toHaveURL(/\/analysing/, { timeout: 120_000 });
  ids.submitToAnalysingMs = Date.now() - tSubmit;
  // stage strings (Realtime on practice_sessions)
  const stages = new Set<string>();
  const t1 = Date.now();
  let retries = 0;
  while (!/\/reports\//.test(page.url()) && Date.now() - t1 < 270_000) {
    const txt = await page.getByTestId("analysis-stage").innerText().catch(() => "");
    if (txt.trim()) stages.add(txt.trim());
    // the real AI service answers 503 now and then (one key per purpose): the designed failure card offers "Try again"
    const retry = page.getByRole("button", { name: "Try again" });
    if (retries < 3 && (await retry.isVisible().catch(() => false))) { retries++; await retry.click(); }
    await page.waitForTimeout(250);
  }
  ids.analysisRetries = retries;
  ids.analysisStages = [...stages];
  await expect(page).toHaveURL(/\/reports\//, { timeout: 30_000 });
  ids.submitToReportMs = Date.now() - tSubmit; save();
  reportId = page.url().match(/reports\/([^/?]+)/)![1]!;
  ids.reportId = reportId;

  // report content: 4 scored sub-scores + Pacing info, per-slide results, transcript
  const subs = page.getByRole("list", { name: "Sub-scores" });
  for (const l of ["Timing", "Pacing", "Filler words", "Slide coverage", "Clarity"]) await expect(subs.getByText(l, { exact: true })).toBeVisible();
  await expect(subs).toContainText("For your information");
  await expect(page.getByText("Top 3 things to fix next time")).toBeVisible();
  await expect(page.getByText("What you did well")).toBeVisible();

  // DB
  const { data: s2 } = await client.from("practice_sessions").select("status,analysis_stage,error_code").eq("id", sessionId).single();
  expect(s2).toMatchObject({ status: "completed", analysis_stage: null, error_code: null });
  const { data: rep } = await client.from("reports").select("*").eq("id", reportId).single();
  expect(rep!.attempt_number).toBe(1);
  const avg = Math.round((rep!.coverage_score * 35 + rep!.clarity_score * 25 + rep!.timing_score * 20 + rep!.filler_score * 20) / 100);
  expect(Math.abs(rep!.overall_score - avg)).toBeLessThanOrEqual(1); // Coverage 35 / Clarity 25 / Timing 20 / Fillers 20 (Pacing is info only)
  expect(rep!.top_fixes).toHaveLength(3); expect(rep!.did_well).toHaveLength(3);
  const { data: res } = await client.from("session_slide_results").select("slide_index,duration_ms,word_count,transcript,key_points_covered,key_points_missed,fillers,word_timings").eq("session_id", sessionId).order("slide_index");
  expect(res).toHaveLength(3);
  for (const r of res!) { expect((r.transcript ?? "").length).toBeGreaterThan(5); expect(r.duration_ms).toBeGreaterThan(3000); expect(Array.isArray(r.word_timings)).toBe(true); }
  ids.fillersDetected = res!.map((r) => r.fillers);
  const { data: usage1 } = await client.from("usage_events").select("id");
  expect(usage1).toHaveLength(1);
  mark("first_report");
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
});

test("5.4 rating once, history / pin / deck detail, retake (cost) with delta", async () => {
  await ensureDeck();
  if (!reportId) { const { data } = await client.from("reports").select("id").eq("attempt_number", 1).limit(1).single(); reportId = data!.id; await page.goto(`/reports/${reportId}`); }
  // rate: 5 stars buttons, comment, thank-you; a second rating is refused by the backend
  await expect(page.getByRole("radio")).toHaveCount(5);
  await page.getByRole("radio", { name: "4 stars" }).click();
  await page.getByLabel("Comment (optional)").fill("Clear and useful (integration test)");
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
  const { data: rr } = await client.from("report_ratings").select("stars,comment").eq("report_id", reportId);
  expect(rr).toEqual([{ stars: 4, comment: "Clear and useful (integration test)" }]);
  const again = await client.rpc("rate_report", { p_report_id: reportId, p_stars: 5 });
  expect(again.error?.message).toBe("already_rated");

  // history + pin persisted across reload
  await page.goto("/history");
  const row = page.getByTestId("deck-row").first();
  await expect(row).toContainText("1 attempt");
  await page.getByRole("button", { name: /^Pin / }).click();
  await expect(page.getByText("Deck pinned to top")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("deck-row").first()).toContainText("Pinned");
  const { data: pinned } = await client.from("decks").select("pinned_at").eq("id", deckId).single();
  expect(pinned!.pinned_at).not.toBeNull();

  // retake: cost note, usage +1, report with delta vs the first attempt
  await page.goto(`/reports/${reportId}`);
  await expect(page.getByText("A retake uses 1 of your 5 sessions today.")).toBeVisible();
  await page.getByRole("button", { name: "Retake this presentation" }).click();
  await expect(page).toHaveURL(/\/time/);
  await expect(page.getByText("This retake uses 1 of your 5 sessions today.")).toBeVisible();
  await page.getByRole("button", { name: "Continue to mic check" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByText("Microphone connected")).toBeVisible();
  await page.getByRole("button", { name: "Enter practice room" }).click();
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.waitForTimeout(5500);
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await page.getByRole("button", { name: "Review and submit" }).first().click();
  await expect(page.getByText("2 slides are not recorded yet.")).toBeVisible();
  await page.getByRole("button", { name: "Submit for feedback" }).click();
  await page.getByRole("button", { name: "Submit anyway" }).click();
  for (let i = 0, t = Date.now(); !/\/reports\//.test(page.url()) && Date.now() - t < 290_000; i++) { const r = page.getByRole("button", { name: "Try again" }); if (i < 3 * 400 && (await r.isVisible().catch(() => false))) await r.click(); await page.waitForTimeout(500); }
  await expect(page).toHaveURL(/\/reports\//, { timeout: 10_000 });
  await expect(page.getByText(/from your first attempt/)).toBeVisible();
  await expect(page.getByText("Attempt 2")).toBeVisible();
  await expect(page.getByText("Not recorded").first()).toBeVisible();
  const { data: usage2 } = await client.from("usage_events").select("id");
  expect(usage2).toHaveLength(2); // upload + the retake
  const { data: stats } = await client.rpc("my_dashboard_stats");
  expect(stats![0]).toMatchObject({ sessions_used_today: 2, attempts_count: 2 });
  ids.report2 = page.url().match(/reports\/([^/?]+)/)![1];

  // deck detail: first vs latest
  await page.goto(`/history/${deckId}`);
  await expect(page.getByText("Sub-scores by attempt")).toBeVisible();
  await expect(page.getByLabel("Attempts").getByText("Attempt 2")).toBeVisible();
  mark("retake_done");
  expect(con.errors(), con.errors().join("\n")).toEqual([]);
});
