import { describe, expect, it } from "vitest";
import { countFillers } from "@shared/scoring.ts";
import { formatDate, formatDayMonth, istDateString, mmss, nextIstMidnight, relativeDay, untilReset } from "@/lib/format";
import { SCORE_COLOR, scoreBand, scoreColor, splitFillers } from "@/lib/score";
import { suggestedSeconds } from "@shared/scoring.ts";

describe("mm:ss and dates", () => {
  it("formats seconds as m:ss", () => {
    expect([0, 5, 59, 60, 61, 289, 600].map(mmss)).toEqual(["0:00", "0:05", "0:59", "1:00", "1:01", "4:49", "10:00"]);
    expect(mmss(59.6)).toBe("1:00");
    expect(mmss(-4)).toBe("0:00");
  });
  it("formats en-IN dates in IST", () => {
    expect(formatDate("2026-10-06T10:00:00Z")).toBe("6 Oct 2026");
    expect(formatDayMonth("2026-09-23T10:00:00Z")).toBe("23 Sep");
    // 19:00 UTC on 6 Oct is already 00:30 on 7 Oct in IST
    expect(formatDate("2026-10-06T19:00:00Z")).toBe("7 Oct 2026");
  });
  it("computes the next IST midnight (UTC+05:30, no DST)", () => {
    expect(nextIstMidnight(new Date("2026-10-14T10:00:00Z"))).toBe("2026-10-14T18:30:00.000Z"); // 00:00 IST on the 15th
    expect(nextIstMidnight(new Date("2026-10-14T18:29:59Z"))).toBe("2026-10-14T18:30:00.000Z");
    expect(nextIstMidnight(new Date("2026-10-14T18:30:00Z"))).toBe("2026-10-15T18:30:00.000Z");
    expect(istDateString(new Date("2026-10-14T18:29:59Z"))).toBe("2026-10-14");
    expect(istDateString(new Date("2026-10-14T18:30:00Z"))).toBe("2026-10-15");
  });
  it("describes the time until reset", () => {
    const now = new Date("2026-10-14T12:30:00Z");
    expect(untilReset("2026-10-14T18:30:00.000Z", now)).toBe("in about 6 hours");
    expect(untilReset("2026-10-14T13:30:00.000Z", now)).toBe("in about an hour");
    expect(untilReset("2026-10-14T12:50:00.000Z", now)).toBe("in about 20 minutes");
  });
  it("labels last-active days", () => {
    const now = new Date("2026-10-14T10:00:00Z");
    expect(relativeDay("2026-10-14T05:00:00Z", now)).toBe("Today");
    expect(relativeDay("2026-10-13T05:00:00Z", now)).toBe("Yesterday");
    expect(relativeDay("2026-09-28T05:00:00Z", now)).toBe("28 Sep");
    expect(relativeDay(null, now)).toBe("–");
  });
});

describe("score presentation rules", () => {
  it("applies the colour rule: ≥75 success, ≥60 marine, else warning", () => {
    expect([100, 75, 74, 60, 59, 0].map(scoreBand)).toEqual(["success", "success", "marine", "marine", "warning", "warning"]);
    expect(scoreColor(80)).toBe(SCORE_COLOR.success);
    expect(scoreColor(62)).toBe(SCORE_COLOR.marine);
    expect(scoreColor(10)).toBe(SCORE_COLOR.warning);
  });
  it("splits transcripts into filler and plain parts with word boundaries", () => {
    const parts = splitFillers("So um we built it. Umbrella, actually, you know it is like great");
    expect(parts.filter((p) => p.filler).map((p) => p.text.toLowerCase())).toEqual(["um", "actually", "you know", "like"]);
    expect(parts.map((p) => p.text).join("")).toBe("So um we built it. Umbrella, actually, you know it is like great");
    expect(splitFillers("Umbrella and unlikely and dislike").some((p) => p.filler)).toBe(false);
    expect(splitFillers("")).toEqual([]);
  });
  it("agrees with the backend filler counter on the same text", () => {
    const text = "Um, basically the thing is, like, actually fine. You know. UH.";
    expect(splitFillers(text).filter((p) => p.filler).length).toBe(countFillers(text).total);
  });
  it("splits the total time across slides by AI weight (round(minutes·60·w/Σw))", () => {
    expect(suggestedSeconds(5, [20, 40, 40, 50, 40, 40, 40, 30])).toEqual([20, 40, 40, 50, 40, 40, 40, 30]);
    expect(suggestedSeconds(1, [10, 10, 10])).toEqual([20, 20, 20]);
    expect(suggestedSeconds(3, [1, 2]).reduce((a, b) => a + b, 0)).toBe(180);
  });
});
