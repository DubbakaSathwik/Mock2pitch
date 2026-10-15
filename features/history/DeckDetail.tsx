"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { Bar } from "@/components/app/Bar";
import { LineChart } from "@/components/app/LineChart";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { Head, StudentShell } from "@/components/app/shells";
import { H, Muted } from "@/components/app/Typography";
import { useDeck, useDeckAttempts } from "@/features/decks/queries";
import { useStartPractice } from "@/features/dashboard/useStartPractice";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { formatDate, mmss, plural } from "@/lib/format";
import { scoreColor } from "@/lib/score";
import type { DeckAttempt } from "@/lib/data/types";
import styles from "./DeckDetail.module.css";

const SUBS: [string, keyof DeckAttempt][] = [["Timing", "timing_score"], ["Filler words", "filler_score"], ["Slide coverage", "coverage_score"], ["Clarity", "clarity_score"]];

/** S16 Deck detail: trend, first vs latest sub-scores, attempts. */
export function DeckDetail() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const deck = useDeck(deckId);
  const attempts = useDeckAttempts(deckId);
  const start = useStartPractice();
  const err = deck.error ?? attempts.error;
  const ui = err ? errorUi(toAppError(err).code) : null;
  const rows = attempts.data ?? [];
  const first = rows[0], latest = rows.at(-1);
  const n = rows.length;
  return (
    <StudentShell active="history">
      <Link href="/history" className={styles.back}><Icon name="chevron-left" size={16} />History</Link>
      {deck.isPending ? <Skeleton h={36} w={320} />
        : ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => { void deck.refetch(); void attempts.refetch(); }} />
        : deck.data && (
          <>
            <Head title={deck.data.deck.title}
              sub={`${deck.data.deck.page_count ?? 0} slides${deck.data.total_target_seconds ? ` · ${mmss(deck.data.total_target_seconds)} target` : ""} · ${plural(n, "attempt")}`}
              right={<Button iconLeft="rotate-ccw" disabled={start.blocked} onClick={() => router.push(start.limitReached ? "/limit" : `/practice/${deckId}/time`)}>Practice again</Button>} />
            <div className={styles.grid}>
              <Card>
                <H l={3} style={{ marginBottom: 8 }}>Score trend</H>
                {n ? <LineChart data={rows.map((r) => ({ label: `Attempt ${r.attempt_number}`, value: r.overall_score }))} ariaLabel="Score trend" /> : <Muted>No reports for this deck yet.</Muted>}
              </Card>
              <Card>
                <H l={3} style={{ marginBottom: 14 }}>Sub-scores by attempt</H>
                {first && latest ? (
                  <>
                    <div className={styles.legend}><span><i className={styles.swFirst} />First attempt</span>{n > 1 && <span><i className={styles.swLatest} />Latest</span>}</div>
                    <div className={styles.subs}>
                      {SUBS.map(([l, key]) => {
                        const a = first[key] as number, b = latest[key] as number;
                        return (
                          <div key={l}>
                            <div className={styles.subHead}><span>{l}</span><span><span className={styles.old}>{a}</span>{n > 1 && <> → <b>{b}</b></>}</span></div>
                            <div className={styles.bars}><Bar v={a} color="var(--ink-300)" h={6} />{n > 1 && <Bar v={b} color={scoreColor(b)} h={6} />}</div>
                          </div>
                        );
                      })}
                      {latest.overall_wpm !== null && <div className={styles.subHead}><span>Pace <Badge tone="neutral">For your information</Badge></span><span><span className={styles.old}>{first.overall_wpm !== null ? Math.round(first.overall_wpm) : "–"}</span>{n > 1 && <> → <b>{Math.round(latest.overall_wpm)}</b></>} wpm</span></div>}
                    </div>
                  </>
                ) : <Muted>Sub-scores appear after your first report.</Muted>}
              </Card>
            </div>
            <Card padding={0} className={styles.attempts} aria-label="Attempts">
              <div style={{ padding: "18px 24px" }}><H l={3}>Attempts</H></div>
              {rows.length === 0 && <div className={styles.none}>No attempts yet. Practise this deck to get your first report.</div>}
              {rows.map((r) => (
                <Link key={r.report_id} href={`/reports/${r.report_id}`} className={styles.attempt}>
                  <div className={styles.attemptScore} style={{ color: scoreColor(r.overall_score) }}>{r.overall_score}</div>
                  <div className={styles.attemptInfo}><div className={styles.attemptTitle}>Attempt {r.attempt_number}</div><Muted>{formatDate(r.created_at)} · {r.attempt_number > 1 ? "Retake" : "First attempt"}</Muted></div>
                  {r.delta_from_first !== null && r.delta_from_first > 0 && <Badge tone="success">+{r.delta_from_first}</Badge>}
                  <Icon name="chevron-right" size={18} color="var(--ink-400)" />
                </Link>
              ))}
            </Card>
          </>
        )}
    </StudentShell>
  );
}
