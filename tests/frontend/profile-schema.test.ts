import { describe, expect, it } from "vitest";
import { profileSchema } from "@/features/profile/schema";

const ok = { full_name: "Ananya Rao", college: "RVIT", year: "3rd year", branch: "CSE" } as const;

describe("profileSchema", () => {
  it("accepts a normal profile and trims the name", () => {
    const r = profileSchema.parse({ ...ok, full_name: "  Ananya Rao  " });
    expect(r.full_name).toBe("Ananya Rao");
  });
  it("requires a name, at most 80 characters", () => {
    expect(profileSchema.safeParse({ ...ok, full_name: "   " }).error?.issues[0]).toMatchObject({ path: ["full_name"], message: "Enter your name" });
    expect(profileSchema.safeParse({ ...ok, full_name: "x".repeat(81) }).error?.issues[0]?.message).toBe("That name is too long");
    expect(profileSchema.safeParse({ ...ok, full_name: "x".repeat(80) }).success).toBe(true);
  });
  it("still validates college, year and branch", () => {
    expect(profileSchema.safeParse({ ...ok, college: "" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...ok, year: "5th year" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...ok, branch: "Law" }).success).toBe(false);
  });
});
