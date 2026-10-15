import { describe, expect, it } from "vitest";
import { BLOCKED_ALLOWED_PREFIXES, decideAdmin, decideSignedIn, decideStudent, withNext } from "@/features/guards/gate";
import { ALL_ERROR_CODES, ERROR_UI, errorUi } from "@/features/errors/map";
import { ERROR_CODES, AppError, toAppError, isCode } from "@/lib/data/errors";
import { safeNext } from "@/lib/safe-next";
import { nextLabel, validateLabel, compareLabels, parseLabel } from "@/features/admin/policy";
import { slotBadges } from "@/features/admin/AiUsage";
import type { AuthSession } from "@/lib/data/types";

const student: AuthSession = { userId: "u", email: "a@b.c", fullName: "A", avatarUrl: null, role: "student" };
const admin: AuthSession = { ...student, role: "admin" };
const ok = { is_blocked: false, profile_completed_at: "2026-01-01T00:00:00Z" };

describe("student route guard (every persona → expected redirect)", () => {
  const base = { pathname: "/dashboard", search: "" };
  it("waits while anything is unresolved (no protected content flash)", () => {
    expect(decideStudent({ ...base, session: undefined, profile: undefined, accepted: undefined })).toEqual({ status: "loading" });
    expect(decideStudent({ ...base, session: student, profile: undefined, accepted: undefined })).toEqual({ status: "loading" });
    expect(decideStudent({ ...base, session: student, profile: ok, accepted: undefined })).toEqual({ status: "loading" });
  });
  it("signed out → /sign-in with the intended destination", () => {
    expect(decideStudent({ pathname: "/reports/abc", search: "?x=1", session: null, profile: undefined, accepted: undefined })).toEqual({ status: "redirect", to: "/sign-in?next=%2Freports%2Fabc%3Fx%3D1" });
  });
  it("admin → /admin (never the student screens)", () => {
    expect(decideStudent({ ...base, session: admin, profile: undefined, accepted: undefined })).toEqual({ status: "redirect", to: "/admin" });
  });
  it("blocked → /paused, except the read-only areas", () => {
    const blocked = { ...ok, is_blocked: true };
    expect(decideStudent({ ...base, session: student, profile: blocked, accepted: true })).toEqual({ status: "redirect", to: "/paused" });
    expect(decideStudent({ pathname: "/practice/new", session: student, profile: blocked, accepted: true })).toEqual({ status: "redirect", to: "/paused" });
    for (const p of BLOCKED_ALLOWED_PREFIXES) expect(decideStudent({ pathname: `${p}/x`, session: student, profile: blocked, accepted: true }).status).toBe("allow");
  });
  it("policy not accepted → /onboarding/terms, then profile incomplete → /onboarding/profile", () => {
    expect(decideStudent({ ...base, session: student, profile: ok, accepted: false })).toEqual({ status: "redirect", to: "/onboarding/terms?next=%2Fdashboard" });
    expect(decideStudent({ ...base, session: student, profile: { ...ok, profile_completed_at: null }, accepted: false }).status).toBe("redirect");
    expect(decideStudent({ ...base, session: student, profile: { ...ok, profile_completed_at: null }, accepted: true })).toEqual({ status: "redirect", to: "/onboarding/profile?next=%2Fdashboard" });
    expect(decideStudent({ pathname: "/onboarding/profile", session: student, profile: { ...ok, profile_completed_at: null }, accepted: true }).status).toBe("allow");
    expect(decideStudent({ pathname: "/onboarding/terms", session: student, profile: ok, accepted: false }).status).toBe("allow");
  });
  it("an in-progress session is never interrupted by a policy update", () => {
    for (const p of ["/session/s1/mic", "/session/s1/room", "/session/s1/review", "/session/s1/analysing"]) {
      expect(decideStudent({ pathname: p, session: student, profile: ok, accepted: false }).status).toBe("allow");
      expect(decideStudent({ pathname: p, session: student, profile: ok, accepted: undefined }).status).toBe("allow");
    }
    expect(decideStudent({ pathname: "/reports/r1", session: student, profile: ok, accepted: false }).status).toBe("redirect");
  });
  it("a fully onboarded student is allowed", () => {
    expect(decideStudent({ ...base, session: student, profile: ok, accepted: true })).toEqual({ status: "allow" });
  });
});

describe("admin + sign-in guards", () => {
  it("admin routes", () => {
    expect(decideAdmin({ session: undefined })).toEqual({ status: "loading" });
    expect(decideAdmin({ session: null })).toEqual({ status: "redirect", to: "/admin/sign-in" });
    expect(decideAdmin({ session: student })).toEqual({ status: "redirect", to: "/dashboard" });
    expect(decideAdmin({ session: admin })).toEqual({ status: "allow" });
  });
  it("sign-in page: signed-in users go where they were heading", () => {
    expect(decideSignedIn({ session: null, next: "/x" })).toEqual({ status: "allow" });
    expect(decideSignedIn({ session: student, next: "/history" })).toEqual({ status: "redirect", to: "/history" });
    expect(decideSignedIn({ session: admin, next: "/history" })).toEqual({ status: "redirect", to: "/admin" });
  });
  it("withNext encodes the destination", () => { expect(withNext("/sign-in", "/a b", "?q=1")).toBe("/sign-in?next=%2Fa%20b%3Fq%3D1"); });
  it("safeNext only accepts same-origin app paths", () => {
    expect(safeNext("/history")).toBe("/history");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "", null, undefined, "/sign-in?next=/x", "/auth/callback", "/admin/sign-in"]) expect(safeNext(bad as string)).toBe("/dashboard");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});

describe("error code → UI mapping (every backend code)", () => {
  it("has an entry for every code in docs/phase-1/api-contracts.md", () => {
    const contract = ["not_authenticated", "policy_not_accepted", "profile_incomplete", "blocked", "is_admin", "daily_limit_reached", "not_pdf", "too_large", "too_many_pages", "encrypted_pdf", "corrupt_pdf", "size_mismatch", "upload_missing", "deck_in_progress", "images_missing", "not_jpeg", "image_too_large", "AI_BUSY", "ai_unavailable", "processing_failed", "report_invalid", "analysis_failed", "audio_invalid", "analysis_stalled", "max_attempts", "analysis_in_progress", "clip_missing", "clip_too_large", "clip_empty", "invalid_slide_index", "duplicate_slide_index", "audio_expired", "no_clips", "invalid_state", "invalid_minutes", "not_found", "invalid_stars", "comment_too_long", "already_rated", "not_latest_policy", "misconfigured"];
    for (const c of contract) expect(ERROR_CODES, c).toContain(c);
    for (const c of ALL_ERROR_CODES) { expect(ERROR_UI[c], c).toBeTypeOf("function"); const ui = errorUi(c, { page_count: 14, max_pages: 10, slide_index: 2 }); expect(ui.kind === "route" ? ui.to : ui.title).toBeTruthy(); }
  });
  it("maps to the screens the contract names", () => {
    expect(errorUi("daily_limit_reached")).toEqual({ kind: "route", to: "/limit" });
    expect(errorUi("policy_not_accepted")).toEqual({ kind: "route", to: "/onboarding/terms" });
    expect(errorUi("profile_incomplete")).toEqual({ kind: "route", to: "/onboarding/profile" });
    expect(errorUi("blocked")).toEqual({ kind: "route", to: "/paused" });
    expect(errorUi("is_admin")).toEqual({ kind: "route", to: "/admin" });
    expect(errorUi("not_authenticated")).toEqual({ kind: "route", to: "/sign-in" });
  });
  it("uses the design's wording and details", () => {
    expect(errorUi("too_many_pages", { page_count: 14, max_pages: 10 })).toMatchObject({ kind: "inline", title: "That deck has 14 slides" });
    expect(errorUi("not_pdf")).toMatchObject({ title: "That file isn't a PDF" });
    expect(errorUi("too_large")).toMatchObject({ title: "That PDF is larger than 5 MB" });
    expect(errorUi("ai_unavailable")).toMatchObject({ title: "Our AI is busy right now", retry: true });
    expect(errorUi("AI_BUSY")).toEqual(errorUi("ai_unavailable"));
    expect(errorUi("audio_invalid", { slide_index: 3 })).toMatchObject({ title: "One recording couldn't be read", body: expect.stringContaining("slide 4") });
    expect(errorUi("report_invalid")).toMatchObject({ retry: true });
  });
});

describe("AppError", () => {
  it("normalises anything thrown", () => {
    expect(toAppError(new AppError("blocked")).code).toBe("blocked");
    expect(toAppError(new TypeError("fetch failed")).code).toBe("network_error");
    expect(toAppError({ code: "daily_limit_reached", message: "x" }).code).toBe("daily_limit_reached");
    expect(toAppError({ code: "something_new" }).code).toBe("unknown");
    expect(toAppError("boom").code).toBe("unknown");
    expect(isCode(new AppError("blocked"), "blocked", "is_admin")).toBe(true);
    expect(isCode(new Error("x"), "blocked")).toBe(false);
  });
});

describe("admin helpers", () => {
  it("version labels", () => {
    expect(parseLabel("v3.0")).toEqual([3, 0]); expect(parseLabel("v4")).toEqual([4, 0]); expect(parseLabel("four")).toBeNull();
    expect(nextLabel("v3.0")).toBe("v4.0"); expect(nextLabel("v3.4")).toBe("v4.0");
    expect(compareLabels("v3.1", "v3.0")).toBeGreaterThan(0);
    expect(validateLabel("v4.0", "v3.0")).toBe(""); expect(validateLabel("v3.1", "v3.0")).toBe(""); expect(validateLabel("v3.0", "v3.0")).toContain("after v3.0"); expect(validateLabel("x", "v3.0")).toBe("Use a label like v4.0");
  });
  it("AI key slot badges", () => {
    const now = Date.parse("2026-10-14T10:00:00Z");
    expect(slotBadges(false, { running_low: false, cooldown_until: null }, now).map((b) => b.label)).toEqual(["Not configured"]);
    expect(slotBadges(true, { running_low: false, cooldown_until: null }, now).map((b) => b.label)).toEqual(["Configured"]);
    expect(slotBadges(true, { running_low: true, cooldown_until: null }, now).map((b) => b.label)).toEqual(["Running low"]);
    expect(slotBadges(true, { running_low: false, cooldown_until: "2026-10-14T10:01:00Z" }, now).map((b) => b.label)).toEqual(["Cooling down"]);
    expect(slotBadges(true, { running_low: true, cooldown_until: "2026-10-14T09:59:00Z" }, now).map((b) => b.label)).toEqual(["Running low"]);
  });
});
