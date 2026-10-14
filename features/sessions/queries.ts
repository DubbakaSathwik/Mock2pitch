"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";

/** Starts (or restarts) a practice session. A retake consumes one daily session, so the usage stats are refreshed. */
export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { deckId: string; minutes: number }) => getData().sessions.start(v.deckId, v.minutes),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.stats }); },
  });
}

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const useSessionInfo = (id: string | undefined) =>
  useQuery({ queryKey: ["sessions", id ?? ""], queryFn: () => getData().sessions.get(id!), enabled: !!id });

/** If the session is already being analysed or finished, send the student to the right screen instead of the recording flow. */
export function useSessionStatusRedirect(id: string | undefined, statusHere: "pre-submit" | "analysing") {
  const router = useRouter();
  const q = useSessionInfo(id);
  useEffect(() => {
    const s = q.data;
    if (!s || !id) return;
    if (s.status === "completed" && s.report_id) router.replace(`/reports/${s.report_id}`);
    else if (statusHere === "pre-submit" && (s.status === "transcribing" || s.status === "generating_report")) router.replace(`/session/${id}/analysing`);
  }, [q.data, id, router, statusHere]);
  return q;
}
