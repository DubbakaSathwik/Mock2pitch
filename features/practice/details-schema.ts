import "@/lib/zod-setup";
import { z } from "zod";
import { AUDIENCES, MAX_ABSTRACT_WORDS, MAX_AUDIENCE_OTHER_CHARS, MAX_GOAL_CHARS, MAX_TOTAL_MINUTES, MIN_TOTAL_MINUTES } from "@shared/constants.ts";
import { countWords } from "@shared/schemas.ts";

/** The Details form (audience, goal, summary, time). Mirrors the server's deckDetailsIn so errors show before the request. */
export const detailsFormSchema = z.object({
  audience: z.enum(AUDIENCES),
  audience_other: z.string().trim().max(MAX_AUDIENCE_OTHER_CHARS, "Keep it under 80 characters"),
  goal: z.string().trim().max(MAX_GOAL_CHARS, `Keep it under ${MAX_GOAL_CHARS} characters`),
  abstract: z.string().trim().refine((v) => countWords(v) <= MAX_ABSTRACT_WORDS, `Keep it to ${MAX_ABSTRACT_WORDS} words or fewer`),
  minutes: z.number({ message: "Enter the time in minutes" }).int("Enter a whole number of minutes").min(MIN_TOTAL_MINUTES, `Enter at least ${MIN_TOTAL_MINUTES} minute`).max(MAX_TOTAL_MINUTES, `The maximum is ${MAX_TOTAL_MINUTES} minutes`),
}).superRefine((d, ctx) => {
  if (d.audience === "others" && !d.audience_other) ctx.addIssue({ code: "custom", path: ["audience_other"], message: "Tell us who you are presenting to" });
});
export type DetailsForm = z.infer<typeof detailsFormSchema>;

/** Form -> the payload of deck-process (optional text left out when empty). */
export function toDeckDetails(f: DetailsForm) {
  return {
    audience: f.audience,
    ...(f.audience === "others" ? { audience_other: f.audience_other } : {}),
    ...(f.goal ? { goal: f.goal } : {}),
    ...(f.abstract ? { abstract: f.abstract } : {}),
    total_minutes: f.minutes,
  };
}
