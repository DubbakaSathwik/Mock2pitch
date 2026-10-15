"use client";
import { useEffect, useState } from "react";

/** Seconds to wait before offering "Try again" after an AI-busy failure. The real backend cools a failing AI key down for 30 s and every
 *  analyse attempt counts toward a cap of 3, so retrying instantly only burns attempts. The in-browser mock has no cooldown (short delay). */
export const AI_RETRY_DELAY_S = process.env.NEXT_PUBLIC_DATA_MODE === "supabase" ? 30 : 2;

/** Counts down from `seconds` whenever `trigger` changes to a non-null value; returns the seconds left (0 = ready). */
export function useRetryDelay(trigger: string | null, seconds = AI_RETRY_DELAY_S): number {
  const [until, setUntil] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => { if (trigger) setUntil(Date.now() + seconds * 1000); }, [trigger, seconds]);
  useEffect(() => {
    if (!until || Date.now() >= until) return;
    const t = setInterval(() => { tick((n) => n + 1); if (Date.now() >= until) clearInterval(t); }, 500);
    return () => clearInterval(t);
  }, [until]);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}
