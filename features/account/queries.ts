"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getData().account.delete("DELETE"),
    onSuccess: () => { qc.clear(); qc.setQueryData(qk.session, null); },
  });
}
