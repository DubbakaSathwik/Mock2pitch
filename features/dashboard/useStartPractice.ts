"use client";
import { useDashboardStats } from "./queries";
import { useMyProfile } from "@/features/profile/queries";

/** Where "Start a new practice" goes: the upload screen, the limit screen (5 used today) or the paused screen (blocked). */
export function useStartPractice() {
  const stats = useDashboardStats();
  const profile = useMyProfile();
  const blocked = !!profile.data?.is_blocked;
  const limitReached = !!stats.data && stats.data.sessions_used_today >= stats.data.daily_limit;
  const href = blocked ? "/paused" : limitReached ? "/limit" : "/practice/new";
  return { href, blocked, limitReached, ready: !!stats.data && !!profile.data };
}
