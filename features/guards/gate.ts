// Route guards as pure functions (UX only — the backend enforces everything). Order for student routes (Phase 2 §3.5):
// signed out → /sign-in · admin → /admin · blocked → /paused · policy not accepted → /onboarding/terms · profile incomplete → /onboarding/profile
import type { AuthSession, ProfileRow } from "@/lib/data/types";

export type Decision = { status: "loading" } | { status: "allow" } | { status: "redirect"; to: string };

export type StudentGateInput = {
  pathname: string; search?: string;
  session: AuthSession | null | undefined;
  profile: Pick<ProfileRow, "is_blocked" | "profile_completed_at"> | undefined;
  accepted: boolean | undefined;
};

/** Read-only areas a blocked student can still open. */
export const BLOCKED_ALLOWED_PREFIXES = ["/paused", "/history", "/reports", "/settings"] as const;
/** An in-progress session (mic check → room → review → analysing) is never interrupted by a policy update. */
export const POLICY_EXEMPT_PREFIXES = ["/session/", "/onboarding/terms"] as const;

const under = (path: string, prefixes: readonly string[]) => prefixes.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p || path.startsWith(`${p}/`)));

export const withNext = (to: string, pathname: string, search = "") => `${to}?next=${encodeURIComponent(pathname + search)}`;

export function decideStudent(i: StudentGateInput): Decision {
  if (i.session === undefined) return { status: "loading" };
  if (i.session === null) return { status: "redirect", to: withNext("/sign-in", i.pathname, i.search) };
  if (i.session.role === "admin") return { status: "redirect", to: "/admin" };
  if (i.profile === undefined || i.accepted === undefined) return { status: "loading" };
  if (i.profile.is_blocked && !under(i.pathname, BLOCKED_ALLOWED_PREFIXES)) return { status: "redirect", to: "/paused" };
  if (!i.accepted && !under(i.pathname, POLICY_EXEMPT_PREFIXES)) return { status: "redirect", to: withNext("/onboarding/terms", i.pathname, i.search) };
  if (!i.profile.profile_completed_at && !under(i.pathname, ["/onboarding", "/session/"]) && !under(i.pathname, BLOCKED_ALLOWED_PREFIXES)) return { status: "redirect", to: withNext("/onboarding/profile", i.pathname, i.search) };
  return { status: "allow" };
}

export function decideAdmin(i: { session: AuthSession | null | undefined }): Decision {
  if (i.session === undefined) return { status: "loading" };
  if (i.session === null) return { status: "redirect", to: "/admin/sign-in" };
  if (i.session.role !== "admin") return { status: "redirect", to: "/dashboard" };
  return { status: "allow" };
}

/** The sign-in page itself: already signed in → go where the user was heading (or home). */
export function decideSignedIn(i: { session: AuthSession | null | undefined; next: string }): Decision {
  if (i.session === undefined) return { status: "loading" };
  if (i.session === null) return { status: "allow" };
  if (i.session.role === "admin") return { status: "redirect", to: "/admin" };
  return { status: "redirect", to: i.next };
}
