"use client";
import { useQuery } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";

export const useDashboardStats = (enabled = true) => useQuery({ queryKey: qk.stats, queryFn: () => getData().dashboard.getStats(), enabled });
export const useRecentReports = (n = 8) => useQuery({ queryKey: qk.recentReports(n), queryFn: () => getData().dashboard.listRecentReports(n) });
