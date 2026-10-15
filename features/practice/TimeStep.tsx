"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { suggestedSeconds } from "@shared/scoring.ts";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { Input } from "@/components/ds/Input";
import { Tabs } from "@/components/ds/Tabs";
import { Bar } from "@/components/app/Bar";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { FlowShell, Head } from "@/components/app/shells";
import { H, Muted } from "@/components/app/Typography";
import { useDeck, useDeckAttempts } from "@/features/decks/queries";
import { errorUi } from "@/features/errors/map";
import { useStartSession } from "@/features/sessions/queries";
import { toAppError } from "@/lib/data/errors";
import { mmss } from "@/lib/format";
import { validateMinutes } from "./minutes";
import styles from "./TimeStep.module.css";

const PRESETS = [3, 5, 7, 10];

/** S9 Set time. Continue starts the practice session (a retake costs one of today's five sessions). */
export function TimeStep() {
  const { deckId } = useParams<{ deckId: string }>();
  const compact = useCompact();
  const router = useRouter();
  const deck = useDeck(deckId);
  const attempts = useDeckAttempts(deckId);
  const start = useStartSession();
  const [v, setV] = useState("5");
  const seeded = deck.data?.latest_total_minutes;
  useEffect(() => { if (seeded) setV(String(seeded)); }, [seeded]);
  const err = validateMinutes(v);
  const n = Number(v);
  const mins = err ? seeded ?? 5 : n;
  const slides = deck.data?.slides ?? [];
  const secs = slides.length ? suggestedSeconds(mins, slides.map((s) => s.time_weight)) : [];
  const maxW = Math.max(1, ...slides.map((s) => s.time_weight));
  const isRetake = (attempts.data?.length ?? 0) >= 1;
  const sErr = start.error ? toAppError(start.error) : null;
  const sUi = sErr ? errorUi(sErr.code, sErr.details) : null;
  useEffect(() => { if (sUi?.kind === "route") router.push(sUi.to); }, [sUi, router]);
  const load = deck.error ? errorUi(toAppError(deck.error).code) : null;
  const go = () => start.mutate({ deckId, minutes: n }, { onSuccess: (s) => router.push(`/session/${s.id}/mic`) });
  return (
    <FlowShell step="time">
      <Head title="Set your time" sub="Choose one total duration. We'll split it across your slides." />
      {deck.isPending ? <Skeleton h={160} r={16} /> : load?.kind === "inline" ? <ErrorNotice title={load.title} body={load.body} onRetry={() => deck.refetch()} /> : (
        <>
          <Card>
            <div className={styles.setter}>
              <Input label="Total duration (minutes)" type="number" inputMode="numeric" min={1} max={20} value={v} error={err} onChange={(e) => setV(e.target.value)} wrapperClassName={styles.minutes} />
              <div className={err ? styles.presetsErr : undefined}>
                <Tabs variant="pill" label="Presets" items={PRESETS.map((p) => ({ value: String(p), label: `${p} min` }))} value={String(n)} onChange={setV} />
              </div>
            </div>
          </Card>
          <Card padding={0} className={styles.table} aria-label="Suggested time per slide">
            <div className={styles.tHead}><H l={3}>Suggested time per slide</H><Badge tone="info">Total {mmss(mins * 60)}</Badge></div>
            <ol className={styles.rows}>
              {slides.map((s, k) => (
                <li key={k} className={styles.row}>
                  <span className={styles.idx}>{k + 1}</span><span className={styles.name}>{s.title ?? `Slide ${k + 1}`}</span>
                  {!compact && <Bar v={(s.time_weight / maxW) * 100} />}
                  <b className={styles.time}>{mmss(secs[k] ?? 0)}</b>
                </li>
              ))}
            </ol>
          </Card>
          <div className={styles.note}><Icon name="timer" size={18} color="var(--bright-marine)" /><Muted>The timer turns red if you run over. It never stops you, and recording is never cut off.</Muted></div>
          {sUi?.kind === "inline" && <div style={{ marginBottom: 16 }}><ErrorNotice title={sUi.title} body={sUi.body} onRetry={sUi.retry ? go : undefined} /></div>}
          <div className={styles.cta}>
            <Button fullWidth={compact} size="lg" disabled={!!err || start.isPending || slides.length === 0} onClick={go}>{start.isPending ? "Starting…" : "Continue to mic check"}</Button>
            {isRetake && <Muted className={styles.cost}>This retake uses 1 of your 5 sessions today.</Muted>}
          </div>
        </>
      )}
    </FlowShell>
  );
}
