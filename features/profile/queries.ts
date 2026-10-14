"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";

export const useMyProfile = (enabled = true) => useQuery({ queryKey: qk.profile, queryFn: () => getData().profile.getMine(), enabled });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { college: string; year: string; branch: string }) => getData().profile.update(input),
    onSuccess: (row) => { qc.setQueryData(qk.profile, row); },
  });
}
