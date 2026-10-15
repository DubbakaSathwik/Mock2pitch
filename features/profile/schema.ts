import { z } from "zod";
import { BRANCHES, COLLEGE_YEARS } from "@shared/constants.ts";

export const profileSchema = z.object({
  college: z.string().trim().min(1, "Enter your college name").max(120, "That name is too long"),
  year: z.enum(COLLEGE_YEARS),
  branch: z.enum(BRANCHES),
});
export type ProfileForm = z.infer<typeof profileSchema>;
