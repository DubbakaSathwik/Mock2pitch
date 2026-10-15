"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";

export const useLatestPolicy = () => useQuery({ queryKey: qk.latestPolicy, queryFn: () => getData().policy.getLatest() });
export const useHasAcceptedPolicy = (enabled = true) => useQuery({ queryKey: qk.acceptedPolicy, queryFn: () => getData().policy.hasAcceptedLatest(), enabled });

export const useAcceptedVersions = (enabled = true) => useQuery({ queryKey: ["policy", "accepted-versions"], queryFn: () => getData().policy.listAccepted(), enabled });

export function useAcceptPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) => getData().policy.accept(versionId),
    onSuccess: () => { qc.setQueryData(qk.acceptedPolicy, true); },
  });
}
