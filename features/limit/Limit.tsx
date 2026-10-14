"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { useCompact } from "@/components/app/Compact";
import { StudentShell } from "@/components/app/shells";
import { Tile } from "@/components/app/Tile";
import { H, P } from "@/components/app/Typography";
import { useDashboardStats } from "@/features/dashboard/queries";
import { untilReset } from "@/lib/format";
import styles from "./Limit.module.css";

/** S18 Limit reached (also the destination of any `daily_limit_reached` error). */
export function Limit() {
  const compact = useCompact();
  const router = useRouter();
  const stats = useDashboardStats();
  const s = stats.data;
  useEffect(() => { if (s && s.sessions_used_today < s.daily_limit) router.replace("/dashboard"); }, [s, router]);
  return (
    <StudentShell active="dashboard">
      <div className={styles.wrap}>
        <div className={styles.tile}><Tile icon="moon" size={64} /></div>
        <H l={1}>That&apos;s {s?.daily_limit ?? 5} sessions today. Time to rest.</H>
        <P style={{ margin: "12px 0 20px" }}>Short, regular practice works better than one long marathon. Your limit resets at midnight IST{s ? `, ${untilReset(s.next_reset_at)}` : ""}.</P>
        <Card variant="sunken" padding={16} className={styles.bar}><ProgressBar value={s?.sessions_used_today ?? 5} max={s?.daily_limit ?? 5} valueLabel={`${s?.sessions_used_today ?? 5} of ${s?.daily_limit ?? 5} sessions used`} tone="marine" ariaLabel="Practice sessions used today" /></Card>
        <div className={styles.actions} style={{ flexDirection: compact ? "column" : "row" }}>
          <Button onClick={() => router.push("/history")}>Review your reports</Button>
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
        </div>
      </div>
    </StudentShell>
  );
}
