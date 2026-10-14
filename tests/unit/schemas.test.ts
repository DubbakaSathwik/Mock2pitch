import { describe, expect, it } from "vitest";
import {
  accountDeleteIn, assetUrlsIn, deckUploadInitIn, reportOut, sanitiseSlideReport, sessionSubmitInitIn, slideReadingOut,
} from "@shared/schemas.ts";
import { parseJsonLoose } from "@shared/nvidia/chat.ts";

const id = "5b0a1c36-5d6a-4a53-9d4c-0e0f6a5c1111";

describe("input schemas", () => {
  it("rejects unknown fields", () => {
    expect(deckUploadInitIn.safeParse({ filename: "a.pdf", size_bytes: 10, content_type: "application/pdf", extra: 1 }).success).toBe(false);
    expect(accountDeleteIn.safeParse({ confirm: "delete" }).success).toBe(false);
    expect(accountDeleteIn.safeParse({ confirm: "DELETE" }).success).toBe(true);
  });
  it("validates uuids / indexes / clip counts", () => {
    expect(assetUrlsIn.safeParse({ deck_id: "nope", kinds: ["slide_image"] }).success).toBe(false);
    expect(assetUrlsIn.safeParse({ deck_id: id, kinds: [] }).success).toBe(false);
    expect(sessionSubmitInitIn.safeParse({ session_id: id, clips: [{ slide_index: 10, size_bytes: 5 }] }).success).toBe(false);
    expect(sessionSubmitInitIn.safeParse({ session_id: id, clips: [] }).success).toBe(false);
    expect(sessionSubmitInitIn.safeParse({ session_id: id, clips: [{ slide_index: 0, size_bytes: 5 }] }).success).toBe(true);
  });
});

describe("slideReadingOut", () => {
  it("clamps and truncates", () => {
    const r = slideReadingOut.parse({ title: "T".repeat(500), slide_text: "x", key_points: Array(9).fill("k".repeat(400)), suggested_script: "s", time_weight: 999 });
    expect(r.title).toHaveLength(120);
    expect(r.key_points).toHaveLength(5);
    expect(r.key_points[0]).toHaveLength(200);
    expect(r.time_weight).toBe(100);
    expect(slideReadingOut.parse({ title: "", slide_text: "", key_points: ["a"], suggested_script: "", time_weight: -4 }).time_weight).toBe(1);
  });
  it("tolerates small-model quirks: missing/null text fields, string weights, key points as {point} objects", () => {
    const r = slideReadingOut.parse({ title: null, key_points: [{ point: " Say hi " }, "Second"], time_weight: "25" });
    expect(r).toEqual({ title: "", slide_text: "", key_points: ["Say hi", "Second"], suggested_script: "", time_weight: 25 });
    expect(slideReadingOut.parse({ key_points: ["a"], time_weight: null }).time_weight).toBe(10);
  });
  it("rejects missing key points / wrong types", () => {
    expect(slideReadingOut.safeParse({ title: "", slide_text: "", key_points: [], suggested_script: "", time_weight: 5 }).success).toBe(false);
    expect(slideReadingOut.safeParse({ title: 3 }).success).toBe(false);
  });
});

describe("reportOut + sanitiser", () => {
  const good = { slides: [{ slide_index: 0, key_points_covered: [0, 5, -1, 1], key_points_missed: [2], off_topic_quotes: ["we like pizza", "invented quote"] }],
    clarity_score: 140, headline: "h", top_fixes: ["a", "b", "c"], did_well: ["a", "b", "c"] };
  it("requires exactly 3 fixes and 3 positives", () => {
    expect(reportOut.safeParse({ ...good, top_fixes: ["a"] }).success).toBe(false);
    expect(reportOut.safeParse({ ...good, did_well: [] }).success).toBe(false);
  });
  it("clamps clarity", () => expect(reportOut.parse(good).clarity_score).toBe(100));
  it("drops invalid key-point indexes and hallucinated quotes; missed is derived", () => {
    const parsed = reportOut.parse(good);
    const s = sanitiseSlideReport(parsed.slides[0]!, 3, "so we like pizza here");
    expect(s.covered).toEqual([0, 1]);
    expect(s.missed).toEqual([2]);
    expect(s.quotes).toEqual(["we like pizza"]);
  });
  it("caps quotes at 3", () => {
    const s = sanitiseSlideReport({ slide_index: 0, key_points_covered: [], key_points_missed: [], off_topic_quotes: ["a", "b", "c", "d"] }, 1, "a b c d");
    expect(s.quotes).toHaveLength(3);
  });
});

describe("parseJsonLoose", () => {
  it("handles fences and prose", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Here you go: {"a":2} thanks')).toEqual({ a: 2 });
    expect(() => parseJsonLoose("no json")).toThrow();
  });
});
