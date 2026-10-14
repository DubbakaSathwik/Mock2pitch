"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { LineChart } from "@/components/app/LineChart";
import { ErrorNotice } from "@/components/app/Notice";
import { Skeleton } from "@/components/app/Loading";
import { Head, StudentShell } from "@/components/app/shells";
import { Tile } from "@/components/app/Tile";
import { H, Muted, P } from "@/components/app/Typography";
import { useCompact } from "@/components/app/Compact";
import { errorUi } from "@/features/errors/map";
import { useDecks } from "@/features/decks/queries";
import { useMyProfile } from "@/features/profile/queries";
import { toAppError } from "@/lib/data/errors";
import { formatDayMonth, mmss, plural } from "@/lib/format";
import { scoreColor } from "@/lib/score";
import { useDashboardStats, useRecentReports } from "./queries";
import { useStartPractice } from "./useStartPractice";
import styles from "./Dashboard.module.css";


export function Dashboard() {
  const compact = useCompact();
  const router = useRouter();
  const profile = useMyProfile();
  const stats = useDashboardStats();
  const decks = useDecks();
  const recent = useRecentReports(8);
  const start = useStartPractice();
  const first = (profile.data?.full_name ?? "").split(" ")[0] || "there";
  const go = () => router.push(start.href);
  const err = stats.error ?? decks.error;
  const ui = err ? errorUi(toAppError(err).code, toAppError(err).details) : null;

  const trend = (() => {
    const rows = [...(recent.data ?? [])].reverse();
    const sameDeck = new Set(rows.map((r) => r.deck_id)).size <= 1;
    return rows.map((r) => ({ label: sameDeck ? `Attempt ${r.attempt_number}` : formatDayMonth(r.created_at), value: r.overall_score }));
  })();
  const s = stats.data;
  const hasHistory = (s?.attempts_count ?? 0) > 0;

  return (
    <StudentShell active="dashboard">
      <Head title={`Hi ${first}, ready to rehearse?`} sub="Take a breath. Nobody is watching but you." right={!compact && <Button size="lg" iconLeft="plus" onClick={go}>Start a new practice</Button>} />
      {compact && <Button fullWidth size="lg" iconLeft="plus" onClick={go} style={{ marginBottom: 16 }}>Start a new practice</Button>}
      {ui?.kind === "inline" && <div style={{ marginBottom: 16 }}><ErrorNotice title={ui.title} body={ui.body} onRetry={() => { void stats.refetch(); void decks.refetch(); }} /></div>}
      <div className={styles.grid}>
        <div className={styles.col}>
          {stats.isPending || decks.isPending ? <Card><Skeleton h={24} w={160} /><Skeleton h={56} style={{ marginTop: 16 }} /></Card>
            : !hasHistory ? (
              <Card padding={compact ? 28 : 48} className={styles.center}>
                <div className={styles.tileRow}><Tile icon="presentation" size={56} /></div>
                <H l={2}>Your first practice starts here</H>
                <P style={{ margin: "8px auto 20px", maxWidth: 420 }}>Upload up to 10 slides. We&apos;ll suggest key points and a script, then you present slide by slide.</P>
                <Button onClick={go}>Upload slides</Button>
              </Card>
            ) : (
              <Card padding={0} aria-label="Recent decks">
                <div style={{ padding: "20px 24px 12px" }}><H l={3}>Recent decks</H></div>
                {(decks.data ?? []).filter((d) => d.attempts_count > 0).slice(0, 3).map((d) => (
                  <Link key={d.deck_id} href={`/history/${d.deck_id}`} className={styles.deck}>
                    <Tile icon="presentation" size={48} />
                    <div className={styles.deckInfo}><div className={styles.deckTitle}>{d.title}</div><Muted>{d.page_count} slides · {plural(d.attempts_count, "attempt")}</Muted></div>
                    <div className={styles.latest}><div className={styles.latestNo} style={{ color: scoreColor(d.latest_score ?? 0) }}>{d.latest_score ?? "–"}</div><Muted style={{ fontSize: 12 }}>latest score</Muted></div>
                    <Icon name="chevron-right" size={18} color="var(--ink-400)" />
                  </Link>
                ))}
              </Card>
            )}
          <Card>
            <H l={3} style={{ marginBottom: 4 }}>Your progress</H>
            <Muted style={{ marginBottom: 12 }}>Score across recent attempts</Muted>
            {trend.length ? <LineChart data={trend} ariaLabel="Score across recent attempts" /> : <div className={styles.empty}>Your score trend will appear after your first report</div>}
          </Card>
        </div>
        <div className={styles.col}>
          <Card>
            <H l={3} style={{ marginBottom: 12 }}>Today&apos;s usage</H>
            <ProgressBar value={s?.sessions_used_today ?? 0} max={s?.daily_limit ?? 5} valueLabel={`${s?.sessions_used_today ?? 0} of ${s?.daily_limit ?? 5} sessions`} label="Practice sessions" />
            <Muted style={{ marginTop: 12 }}>Resets at midnight IST. Up to 10 slides and 20 minutes per presentation.</Muted>
          </Card>
          <Card>
            <H l={3} style={{ marginBottom: 14 }}>Your practice so far</H>
            {!hasHistory ? (
              <div className={styles.center}>
                <div className={styles.tileRow}><Tile icon="mic" size={48} /></div>
                <div className={styles.readyTitle}>Ready for your first practice</div>
                <Muted style={{ margin: "6px 0 14px" }}>Your average score, best score and practice time will show here.</Muted>
                <Button size="sm" onClick={go}>Start now</Button>
              </div>
            ) : s && (
              <div className={styles.tiles}>
                {([
                  ["Average score", String(s.average_score ?? "–"), "across all attempts"],
                  ["Best score", String(s.best_score ?? "–"), `best of ${plural(s.attempts_count, "attempt")}`],
                  ["Practice time", mmss(s.total_practice_ms / 1000), "minutes spoken"],
                  ["Key points", String(s.total_key_points_covered), "covered in total"],
                ] as const).map(([l, v, sub]) => (
                  <div key={l} className={styles.tileStat}><Muted style={{ fontSize: 13 }}>{l}</Muted><div className={styles.statVal}>{v}</div><Muted style={{ fontSize: 12 }}>{sub}</Muted></div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </StudentShell>
  );
}
