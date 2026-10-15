// Single access point for the data port. Components never import an adapter directly.
// The branch below compares the *inlined* NEXT_PUBLIC_DATA_MODE literal, so a `supabase` build contains no mock backend at all.
import { dataMode } from "@/lib/env.public";
import type { DataPort } from "./types";
import type { MockControl } from "./mock";

let current: DataPort | null = null;

export function getData(): DataPort {
  if (current) return current;
  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    current = (require("./supabase") as typeof import("./supabase")).getSupabaseData();
  } else {
    dataMode(); // validates the flag and refuses mock mode in a production build unless explicitly allowed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    current = (require("./mock") as typeof import("./mock")).getBrowserMock().data;
  }
  return current;
}

/** Tests inject their own port (or null to reset). */
export function setData(port: DataPort | null) { current = port; }

export function getMockControl(): MockControl | null {
  if (process.env.NEXT_PUBLIC_DATA_MODE === "supabase" || typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("./mock") as typeof import("./mock")).getBrowserMock().control;
}
