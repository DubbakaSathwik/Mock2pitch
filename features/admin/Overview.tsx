"use client";
import Link from "next/link";
import { Card } from "@/components/ds/Card";
import { BarChart } from "@/components/app/BarChart";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { AdminShell, Head } from "@/components/app/shells";
import { Stars } from "@/components/app/Stars";
import { Stat } from "@/components/app/Stat";
import { H, Muted } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { formatDate, formatDayMonth } from "@/lib/format";
import { useAdminOverview, useAdminRatings, useAiUsage, useSessionsPerDay } from "./queries";
import styles from "./Admin.module.css";

/** A1 Overview. */
export function Overview() {
  const compact = useCompact();
  const ov = useAdminOverview();
  const days = useSessionsPerDay(14);
  const ratings = useAdminRatings(null);
  const ai = useAiUsage(7);
  const err = ov.error ?? days.error;
  const ui = err ? errorUi(toAppError(err).code) : null;
  const d = days.data ?? [];
  const limit = (ai.data?.purposes ?? []).flatMap((p) => p.slots).reduce((a, s) => a + s.credit_limit, 0);
  const o = ov.data;
  return (
    <AdminShell active="/admin">
      <Head title="Overview" sub="Last 14 days" />
      {ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => { void ov.refetch(); void days.refetch(); }} /> : (
        <>
          <div className={styles.stats} style={{ gridTemplateColumns: compact ? "minmax(0,1fr) minmax(0,1fr)" : "repeat(auto-fit,minmax(170px,1fr))" }}>
            {ov.isPending || !o ? [0, 1, 2, 3].map((k) => <Skeleton key={k} h={132} r={16} />) : (
              <>
                <Stat icon="users" label="Total students" value={o.total_students.toLocaleString("en-IN")} sub="Signed in with Google" />
                <Stat icon="mic" label="Practice sessions" value={o.sessions_all_time.toLocaleString("en-IN")} sub={`${o.sessions_last_14_days.toLocaleString("en-IN")} in the last 14 days`} />
                <Stat icon="star" label="Avg report rating" value={o.average_rating ?? "–"} sub={`from ${o.ratings_count.toLocaleString("en-IN")} ratings`} />
                <Stat icon="cpu" label="AI credits used" value={o.ai_credits_used.toLocaleString("en-IN")} sub={limit ? `of ${limit.toLocaleString("en-IN")}` : "this period"} />
              </>
            )}
          </div>
          <div className={styles.two} style={{ gridTemplateColumns: compact ? "minmax(0,1fr)" : "minmax(0,1.5fr) minmax(0,1fr)" }}>
            <Card>
              <H l={3} style={{ marginBottom: 4 }}>Sessions per day</H>
              <Muted style={{ marginBottom: 16 }}>{d.length ? `${formatDayMonth(d[0]!.day)} to ${formatDate(d.at(-1)!.day)}` : "Last 14 days"}</Muted>
              {days.isPending ? <Skeleton h={190} /> : <BarChart data={d.map((x) => x.count)} labels={d.map((x) => formatDayMonth(x.day))} h={170} every={2} caption="Practice sessions per day" />}
            </Card>
            <Card padding={0}>
              <div className={styles.cardHead}><H l={3}>Recent ratings</H><Link href="/admin/ratings">View all</Link></div>
              {ratings.isPending ? <div style={{ padding: 24 }}><Skeleton h={60} /></div> : (ratings.data?.rows ?? []).slice(0, 4).map((r, i) => (
                <div key={i} className={styles.recent}>
                  <div className={styles.recentTop}><b>{r.student_name}</b><Stars n={r.stars} size={14} /></div>
                  <Muted style={{ fontSize: 13 }}>{r.comment || "No comment"}</Muted>
                </div>
              ))}
              {ratings.data && ratings.data.rows.length === 0 && <div style={{ padding: "0 24px 24px" }}><Muted>No ratings yet.</Muted></div>}
            </Card>
          </div>
        </>
      )}
    </AdminShell>
  );
}
