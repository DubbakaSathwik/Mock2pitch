// Single access point for the data port. Components never import an adapter directly.
import { dataMode } from "@/lib/env";
import { getBrowserMock } from "./mock";
import type { DataPort } from "./types";
import type { MockControl } from "./mock";

let current: DataPort | null = null;

export function getData(): DataPort {
  if (current) return current;
  if (dataMode() === "mock") { current = getBrowserMock().data; return current; }
  throw new Error("The Supabase adapter is implemented in Phase 3 (lib/data/supabase/README.md).");
}

/** Tests inject their own port (or null to reset). */
export function setData(port: DataPort | null) { current = port; }

export function getMockControl(): MockControl | null {
  return dataMode() === "mock" && typeof window !== "undefined" ? getBrowserMock().control : null;
}
