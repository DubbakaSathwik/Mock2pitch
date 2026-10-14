"use client";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";
import type { AuthSession } from "@/lib/data/types";

export function useAuthSession() {
  const qc = useQueryClient();
  const q = useQuery<AuthSession | null>({ queryKey: qk.session, queryFn: () => getData().auth.getSession(), staleTime: Infinity });
  useEffect(() => getData().auth.onChange((s) => { qc.clear(); qc.setQueryData(qk.session, s); }), [qc]);
  return q;
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o?: { next?: string; hint?: "owner" }) => getData().auth.signInWithGoogle(o),
    onSuccess: async () => { qc.clear(); await qc.fetchQuery({ queryKey: qk.session, queryFn: () => getData().auth.getSession() }); },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => getData().auth.signOut(),
    onSuccess: () => { qc.clear(); qc.setQueryData(qk.session, null); },
  });
}
