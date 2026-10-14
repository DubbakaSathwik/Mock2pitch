"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";
import type { AdminStudent } from "@/lib/data/types";

export const useAdminOverview = () => useQuery({ queryKey: qk.adminOverview, queryFn: () => getData().admin.overview() });
export const useSessionsPerDay = (days = 14) => useQuery({ queryKey: qk.adminSessionsPerDay(days), queryFn: () => getData().admin.sessionsPerDay(days) });
export const useAdminStudents = (search: string, limit = 25) => useQuery({ queryKey: [...qk.adminStudents(search), limit], queryFn: () => getData().admin.listStudents({ search, limit }), placeholderData: (p) => p });
export const useStudentDetail = (id: string | undefined) => useQuery({ queryKey: qk.adminStudent(id ?? ""), queryFn: () => getData().admin.studentDetail(id!), enabled: !!id });
export const useAdminRatings = (stars: number | null) => useQuery({ queryKey: qk.adminRatings(stars), queryFn: () => getData().admin.ratings(stars ?? undefined) });
export const useAiUsage = (days = 7) => useQuery({ queryKey: qk.adminAiUsage(days), queryFn: () => getData().admin.aiUsage(days) });
export const useAiKeys = () => useQuery({ queryKey: qk.adminAiKeys, queryFn: () => getData().admin.aiKeys() });
export const usePolicyVersions = () => useQuery({ queryKey: qk.adminPolicies, queryFn: () => getData().admin.policyVersions() });

/** Block / unblock with optimistic row state; rolled back if the call fails. */
export function useSetBlocked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) => getData().admin.setBlocked(userId, blocked),
    onMutate: async ({ userId, blocked }) => {
      await qc.cancelQueries({ queryKey: ["admin"] });
      const snaps = qc.getQueriesData<AdminStudent[]>({ queryKey: ["admin", "students"] });
      for (const [key, rows] of snaps) if (rows) qc.setQueryData(key, rows.map((r) => (r.user_id === userId ? { ...r, is_blocked: blocked } : r)));
      const detailKey = qk.adminStudent(userId);
      const detail = qc.getQueryData<{ profile: { is_blocked: boolean } }>(detailKey);
      if (detail) qc.setQueryData(detailKey, { ...detail, profile: { ...detail.profile, is_blocked: blocked } });
      return { snaps, detail, detailKey };
    },
    onError: (_e, _v, ctx) => {
      if (!ctx) return;
      for (const [key, rows] of ctx.snaps) qc.setQueryData(key, rows);
      if (ctx.detail) qc.setQueryData(ctx.detailKey, ctx.detail);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ["admin"] }); },
  });
}

export function usePublishPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { version_label: string; terms_body: string; privacy_body: string; note?: string }) => getData().admin.publishPolicy(v),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: qk.adminPolicies }); void qc.invalidateQueries({ queryKey: qk.latestPolicy }); },
  });
}
