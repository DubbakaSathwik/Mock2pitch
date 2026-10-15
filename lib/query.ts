import { QueryClient } from "@tanstack/react-query";
import { AppError } from "@/lib/data/errors";

export const qk = {
  session: ["auth", "session"] as const,
  profile: ["profile"] as const,
  latestPolicy: ["policy", "latest"] as const,
  acceptedPolicy: ["policy", "accepted"] as const,
  stats: ["dashboard", "stats"] as const,
  recentReports: (n: number) => ["dashboard", "recent-reports", n] as const,
  decks: ["decks"] as const,
  deck: (id: string) => ["decks", id] as const,
  deckAttempts: (id: string) => ["decks", id, "attempts"] as const,
  slideImages: (id: string) => ["decks", id, "slide-images"] as const,
  report: (id: string) => ["reports", id] as const,
  adminOverview: ["admin", "overview"] as const,
  adminSessionsPerDay: (d: number) => ["admin", "sessions-per-day", d] as const,
  adminStudents: (q: string) => ["admin", "students", q] as const,
  adminStudent: (id: string) => ["admin", "student", id] as const,
  adminRatings: (s: number | null) => ["admin", "ratings", s] as const,
  adminAiUsage: (d: number) => ["admin", "ai-usage", d] as const,
  adminAiKeys: ["admin", "ai-keys"] as const,
  adminPolicies: ["admin", "policies"] as const,
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000, refetchOnWindowFocus: false,
        retry: (count, err) => err instanceof AppError && err.code === "network_error" && count < 2,
      },
      mutations: { retry: false },
    },
  });
}
