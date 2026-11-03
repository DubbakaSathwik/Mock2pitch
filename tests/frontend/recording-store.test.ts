import { afterEach, describe, expect, it, vi } from "vitest";
import { recordingStore } from "@/features/recording/store";

const clip = { blob: new Blob(["x"]), mime: "audio/webm", durationMs: 1000 };
vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() }));
afterEach(() => { vi.useRealTimers(); recordingStore.reset(); });

describe("recordingStore.scheduleClear (the report page lets go of recordings after you leave it)", () => {
  it("clears a session's clips after the delay", () => {
    vi.useFakeTimers();
    recordingStore.setClip("s1", 0, clip);
    recordingStore.scheduleClear("s1", 400);
    expect(recordingStore.list("s1")).toHaveLength(1);
    vi.advanceTimersByTime(401);
    expect(recordingStore.list("s1")).toHaveLength(0);
  });
  it("is cancelled by a quick remount (React StrictMode, back-and-forth), so playback survives", () => {
    vi.useFakeTimers();
    recordingStore.setClip("s1", 0, clip);
    recordingStore.scheduleClear("s1", 400);
    recordingStore.cancelClear("s1");
    vi.advanceTimersByTime(1000);
    expect(recordingStore.list("s1")).toHaveLength(1);
  });
  it("only touches the scheduled session and a second schedule restarts the timer", () => {
    vi.useFakeTimers();
    recordingStore.setClip("s1", 0, clip); recordingStore.setClip("s2", 0, clip);
    recordingStore.scheduleClear("s1", 400);
    vi.advanceTimersByTime(300);
    recordingStore.scheduleClear("s1", 400);
    vi.advanceTimersByTime(300);
    expect(recordingStore.list("s1")).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(recordingStore.list("s1")).toHaveLength(0);
    expect(recordingStore.list("s2")).toHaveLength(1);
  });
});
