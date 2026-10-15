"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon, type IconName } from "@/components/ds/Icon";
import { Input } from "@/components/ds/Input";
import { ScoreRing } from "@/components/ds/ScoreRing";
import { useToast } from "@/components/ds/Toast";
import { useCompact } from "@/components/app/Compact";
import { FillerText } from "@/components/app/FillerText";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { StudentShell } from "@/components/app/shells";
import { StarRating, Stars } from "@/components/app/Stars";
import { Tile } from "@/components/app/Tile";
import { H, Muted, Overline, P } from "@/components/app/Typography";
import { useDeckAttempts } from "@/features/decks/queries";
import { useStartPractice } from "@/features/dashboard/useStartPractice";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import type { ReportDetail } from "@/lib/data/types";
import { formatDate, mmss } from "@/lib/format";
import { SCORE_WORD, scoreBand, scoreColor } from "@/lib/score";
import { useRateReport, useReport } from "./queries";
import styles from "./Report.module.css";

/** Parakeet drops short hesitation sounds (Phase 3 finding), so say what is counted (owner decision Q4). */
export const FILLER_NOTE = "We count words like \u2018like\u2019, \u2018basically\u2019 and \u2018you know\u2019. Short sounds like \u2018um\u2019 may not be picked up.";

type Card5 = { key: string; label: string; icon: IconName; value: string; info?: boolean; sub: string; delta?: number | null; color?: string; band?: string };

function subCards(d: ReportDetail, first: { timing: number; filler: number; coverage: number; clarity: number } | null): Card5[] {
  const r = d.report;
  const withDelta = (now: number, was: number | undefined) => (first && was !== undefined && r.attempt_number > 1 ? now - was : null);
  const mk = (key: string, label: string, icon: IconName, v: number, sub: string, was?: number): Card5 => ({ key, label, icon, value: String(v), sub, delta: withDelta(v, was), color: scoreColor(v), band: SCORE_WORD[scoreBand(v)] });
  return [
    mk("timing", "Timing", "timer", r.timing_score, `${mmss((r.total_duration_ms ?? 0) / 1000)} of ${mmss(d.target_seconds)}`, first?.timing),
    { key: "pacing", label: "Pacing", icon: "gauge", value: r.overall_wpm !== null ? `${Math.round(r.overall_wpm)}` : "–", info: true, sub: "words per minute" },
    mk("fillers", "Filler words", "message-square-warning", r.filler_score, `${r.filler_total ?? 0} filler ${r.filler_total === 1 ? "word" : "words"}`, first?.filler),
    mk("coverage", "Slide coverage", "list-checks", r.coverage_score, `${r.key_points_covered ?? 0} of ${r.key_points_total ?? 0} key points`, first?.coverage),
    mk("clarity", "Clarity", "message-square-text", r.clarity_score, "Sentences and English", first?.clarity),
  ];
}

function SlideRows({ d }: { d: ReportDetail }) {
  const compact = useCompact();
  const firstRecorded = d.results.findIndex((x) => x.duration_ms > 0);
  const [open, setOpen] = useState(firstRecorded);
  return (
    <ul className={styles.slides}>
      {d.slides.map((s, i) => {
        const res = d.results.find((x) => x.slide_index === s.slide_index);
        const recorded = !!res && res.duration_ms > 0;
        const isOpen = open === i;
        const t = (res?.duration_ms ?? 0) / 1000, g = res?.suggested_seconds ?? 0;
        const missed = res?.key_points_missed ?? [];
        const fn = res?.filler_count ?? 0;
        const panelId = `slide-panel-${i}`;
        return (
          <li key={i}>
            <Card padding={0}>
              <button type="button" className={styles.rowBtn} aria-expanded={isOpen} aria-controls={panelId} onClick={() => setOpen(isOpen ? -1 : i)}>
                {!compact && <span className={styles.idx}>{i + 1}</span>}
                <span className={styles.rowTitle}>{compact ? `${i + 1}. ` : ""}{s.title ?? `Slide ${i + 1}`}</span>
                {recorded ? <Badge tone={t > g + 5 ? "warning" : "success"}>{mmss(t)} / {mmss(g)}</Badge> : <Badge tone="neutral">Not recorded</Badge>}
                {!compact && recorded && <Badge tone={missed.length ? "warning" : "success"}>{s.key_points.length - missed.length}/{s.key_points.length} points</Badge>}
                {!compact && recorded && <Badge tone={fn > 2 ? "warning" : "neutral"}>{fn} {fn === 1 ? "filler" : "fillers"}</Badge>}
                {!compact && <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="var(--ink-500)" />}
              </button>
              {isOpen && (
                <div id={panelId} className={styles.panel}>
                  {!recorded ? <P style={{ fontSize: 14 }}>You didn&apos;t record this slide, so its key points count as missed.</P> : (
                    <>
                      <div className={styles.two}>
                        <div>
                          <Overline style={{ marginBottom: 8 }}>Key points</Overline>
                          {s.key_points.map((k, x) => { const miss = missed.includes(x); return (
                            <div key={x} className={styles.kp}><Icon name={miss ? "circle-x" : "circle-check"} size={16} color={miss ? "var(--warning-500)" : "var(--success-500)"} style={{ marginTop: 3 }} /><span>{k} <b style={{ color: miss ? "var(--warning-text)" : "var(--success-text)" }}>{miss ? "· missed" : "· covered"}</b></span></div>
                          ); })}
                        </div>
                        <div>
                          <Overline style={{ marginBottom: 8 }}>Time and fillers</Overline>
                          <P style={{ fontSize: 14 }}>You took {mmss(t)} against {mmss(g)} suggested ({t > g ? `${Math.round(t - g)}s over` : `${Math.round(g - t)}s under`}).</P>
                          <P style={{ fontSize: 14, marginTop: 6 }}>{fn ? `${fn} filler ${fn === 1 ? "word" : "words"}: ${(res?.fillers ?? []).map((f) => `"${f.word}" × ${f.count}`).join(", ")}` : "No filler words. Well done."}</P>
                          <div data-testid="filler-note-slide"><Muted style={{ fontSize: 12, marginTop: 6 }}>{FILLER_NOTE}</Muted></div>
                        </div>
                      </div>
                      {(res?.off_topic_quotes ?? []).length > 0 && (
                        <div><Overline style={{ marginBottom: 8 }}>Off-topic or unnecessary</Overline>
                          {res!.off_topic_quotes!.map((q, k) => <div key={k} className={styles.off}>&ldquo;{q}&rdquo;<div style={{ color: "var(--ink-600)", marginTop: 2 }}>This didn&apos;t support a key point. Consider cutting it.</div></div>)}
                        </div>
                      )}
                      <div><Overline style={{ marginBottom: 8 }}>Transcript</Overline><div className={styles.transcript}><FillerText text={res?.transcript ?? ""} /></div></div>
                    </>
                  )}
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function RateCard({ d }: { d: ReportDetail }) {
  const { toast } = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const rate = useRateReport(d.report.id);
  const err = rate.error ? toAppError(rate.error) : null;
  useEffect(() => { if (err?.code === "already_rated") setSent(true); }, [err]);
  if (sent) return <Card className={styles.rate}><div className={styles.thanks}><Tile icon="heart" /><div><H l={3}>Thank you</H><Muted>Your rating helps us improve the reports.</Muted></div></div></Card>;
  if (d.rating) {
    return (
      <Card className={styles.rate}>
        <H l={3} style={{ marginBottom: 6 }}>Your rating</H>
        <Stars n={d.rating.stars} size={22} />
        {d.rating.comment && <P style={{ marginTop: 8, fontSize: 15 }}>{d.rating.comment}</P>}
        <Muted style={{ marginTop: 8 }}>Thank you. Your rating helps us improve the reports.</Muted>
      </Card>
    );
  }
  const ui = err && err.code !== "already_rated" ? errorUi(err.code, err.details) : null;
  return (
    <Card className={styles.rate}>
      <H l={3} style={{ marginBottom: 4 }}>Rate this report</H>
      <Muted style={{ marginBottom: 12 }}>Was it clear and useful?</Muted>
      <div style={{ marginBottom: 14 }}><StarRating value={stars} onChange={setStars} label="Rate this report" /></div>
      <Input label="Comment (optional)" placeholder="Add a comment (optional)" value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} hint={`${comment.length}/500`} />
      {ui?.kind === "inline" && <div style={{ marginTop: 12 }}><ErrorNotice title={ui.title} body={ui.body} /></div>}
      <Button style={{ marginTop: 14 }} disabled={!stars || rate.isPending} onClick={() => rate.mutate({ stars, comment: comment.trim() || undefined }, { onSuccess: () => { setSent(true); toast("Rating sent"); } })}>{rate.isPending ? "Sending…" : "Send rating"}</Button>
    </Card>
  );
}

/** S14 Report. Four scored sub-scores + Pacing as information only (D10). */
export function Report() {
  const { reportId } = useParams<{ reportId: string }>();
  const compact = useCompact();
  const router = useRouter();
  const q = useReport(reportId);
  const attempts = useDeckAttempts(q.data?.deck_id);
  const start = useStartPractice();
  const ui = q.error ? errorUi(toAppError(q.error).code) : null;
  const d = q.data;
  const f = attempts.data?.[0];
  const first = f && d && d.report.attempt_number > 1 ? { timing: f.timing_score, filler: f.filler_score, coverage: f.coverage_score, clarity: f.clarity_score } : null;
  const retake = () => router.push(start.limitReached ? "/limit" : `/practice/${d?.deck_id}/time`);
  return (
    <StudentShell active="history" maxW={1000}>
      {q.isPending ? <><Skeleton h={28} w={200} style={{ marginBottom: 16 }} /><Skeleton h={220} r={24} /></>
        : ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => q.refetch()} />
        : d && (
          <>
            <Link href={`/history/${d.deck_id}`} className={styles.back}><Icon name="chevron-left" size={16} />{d.deck_title}</Link>
            <section className={styles.hero} aria-label="Overall score">
              <ScoreRing value={d.report.overall_score} size={compact ? 140 : 168} stroke={14} label="out of 100" color="var(--icy-blue)" track="rgba(166,225,250,.2)" textColor="#fff" />
              <div>
                <Overline color="var(--icy-blue)">Attempt {d.report.attempt_number} · {formatDate(d.report.created_at)}</Overline>
                <h1 className={styles.headline}>{d.report.headline}</h1>
                {d.report.attempt_number > 1 && d.report.delta_from_first !== null && d.report.first_attempt_score !== null
                  ? <div className={`${styles.delta} ${d.report.delta_from_first < 0 ? styles.deltaNeg : ""}`}><Icon name="trending-up" size={18} />{d.report.delta_from_first >= 0 ? "+" : "−"}{Math.abs(d.report.delta_from_first)} from your first attempt ({d.report.first_attempt_score})</div>
                  : <Muted style={{ color: "var(--icy-blue)" }}>Your first report. Every retake shows how far you&apos;ve come.</Muted>}
              </div>
            </section>
            <ul className={styles.subs} aria-label="Sub-scores">
              {subCards(d, first).map((c) => (
                <li key={c.key}>
                  <Card padding={18} className={styles.sub}>
                    <div className={styles.subTop}><Tile icon={c.icon} size={32} />{c.delta !== null && c.delta !== undefined && <Badge tone={c.delta >= 0 ? "success" : "neutral"}>{c.delta >= 0 ? "+" : "−"}{Math.abs(c.delta)}</Badge>}</div>
                    <div className={styles.subVal} style={{ color: c.info ? "var(--text-strong)" : c.color }}>{c.value}{c.info && <span className={styles.unit}> wpm</span>}</div>
                    <div className={styles.subLabel}>{c.label}</div>
                    {c.info ? <Badge tone="neutral" style={{ marginTop: 4 }}>For your information</Badge> : <span className="sr-only">{c.band}. </span>}
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>{c.sub}</Muted>
                    {c.key === "fillers" && <div data-testid="filler-note"><Muted style={{ fontSize: 12, marginTop: 6 }}>{FILLER_NOTE}</Muted></div>}
                  </Card>
                </li>
              ))}
            </ul>
            <div className={styles.two}>
              <Card><div className={styles.cardHead}><Tile icon="target" size={32} /><H l={3}>Top 3 things to fix next time</H></div>
                <ol className={styles.fixes}>{d.report.top_fixes.map((x, i) => <li key={i}><span className={styles.fixNo}>{i + 1}</span><P style={{ fontSize: 15 }}>{x}</P></li>)}</ol>
              </Card>
              <Card><div className={styles.cardHead}><div className={styles.okTile}><Icon name="circle-check" size={18} /></div><H l={3}>What you did well</H></div>
                <ul className={styles.well}>{d.report.did_well.map((x, i) => <li key={i}><Icon name="check" size={18} color="var(--success-500)" style={{ marginTop: 3 }} /><P style={{ fontSize: 15 }}>{x}</P></li>)}</ul>
              </Card>
            </div>
            <H l={2} className={styles.sectionHead}>Slide by slide</H>
            <SlideRows d={d} />
            <RateCard key={d.report.id} d={d} />
            <div className={styles.actions}>
              <div>
                <Button size="lg" iconLeft="rotate-ccw" fullWidth={compact} disabled={start.blocked} onClick={retake}>Retake this presentation</Button>
                <Muted style={{ marginTop: 6 }}>A retake uses 1 of your 5 sessions today.</Muted>
              </div>
              <Button size="lg" variant="secondary" fullWidth={compact} onClick={() => router.push("/dashboard")}>Back to dashboard</Button>
            </div>
          </>
        )}
    </StudentShell>
  );
}
