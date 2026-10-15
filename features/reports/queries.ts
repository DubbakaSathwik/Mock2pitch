"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";

export const useReport = (id: string | undefined) => useQuery({ queryKey: qk.report(id ?? ""), queryFn: () => getData().reports.get(id!), enabled: !!id });

export function useRateReport(reportId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { stars: number; comment?: string }) => getData().reports.rate(reportId, v.stars, v.comment),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.report(reportId) }); },
  });
}
