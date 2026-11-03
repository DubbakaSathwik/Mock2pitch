"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";
import type { AuthSession } from "@/lib/data/types";

export const useMyProfile = (enabled = true) => useQuery({ queryKey: qk.profile, queryFn: () => getData().profile.getMine(), enabled });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { college: string; year: string; branch: string; full_name?: string }) => getData().profile.update(input),
    onSuccess: (row) => {
      qc.setQueryData(qk.profile, row);
      // The signed-in session caches the display name too (practice room, shells): keep it in step with the edit.
      qc.setQueryData<AuthSession | null | undefined>(qk.session, (s) => (s ? { ...s, fullName: row.full_name } : s));
    },
  });
}
