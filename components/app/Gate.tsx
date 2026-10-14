"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import { useAuthSession } from "@/features/auth/queries";
import { useMyProfile } from "@/features/profile/queries";
import { useHasAcceptedPolicy } from "@/features/policy/queries";
import { decideAdmin, decideStudent, type Decision } from "@/features/guards/gate";
import { LoadingShell } from "./Loading";

function useRedirect(d: Decision) {
  const router = useRouter();
  useEffect(() => { if (d.status === "redirect") router.replace(d.to); }, [d, router]);
}

/** Wraps every student route. Renders children only once the user is allowed (no flash of protected content). */
export function StudentGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useAuthSession();
  const isStudent = session.data?.role === "student";
  const profile = useMyProfile(isStudent);
  const accepted = useHasAcceptedPolicy(isStudent);
  const qc = useQueryClient();
  // A new policy version can be published at any time: re-check on every navigation (never during an in-progress session — see gate.ts).
  useEffect(() => { void qc.invalidateQueries({ queryKey: qk.acceptedPolicy }); }, [pathname, qc]);
  const d = decideStudent({
    pathname, search: typeof window !== "undefined" ? window.location.search : "",
    session: session.isPending ? undefined : session.data ?? null,
    profile: isStudent ? profile.data : undefined, accepted: isStudent ? accepted.data : undefined,
  });
  useRedirect(d);
  if (d.status !== "allow") return <LoadingShell />;
  return <>{children}</>;
}

export function AdminGate({ children }: { children: ReactNode }) {
  const session = useAuthSession();
  const d = decideAdmin({ session: session.isPending ? undefined : session.data ?? null });
  useRedirect(d);
  if (d.status !== "allow") return <LoadingShell />;
  return <>{children}</>;
}
