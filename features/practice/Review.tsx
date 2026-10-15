"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Dialog } from "@/components/ds/Dialog";
import { Icon } from "@/components/ds/Icon";
import { IconButton } from "@/components/ds/IconButton";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice, Notice } from "@/components/app/Notice";
import { FlowShell, Head } from "@/components/app/shells";
import { Muted, P } from "@/components/app/Typography";
import { useDeck } from "@/features/decks/queries";
import { useBeforeUnload, useClipPlayback } from "@/features/recording/hooks";
import { recordingStore, useRecordingStore } from "@/features/recording/store";
import { useSessionStatusRedirect } from "@/features/sessions/queries";
import { mmss } from "@/lib/format";
import { useSubmitFlow } from "./useSubmitFlow";
import styles from "./Review.module.css";

/** S12 Review and submit. */
export function Review() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const compact = useCompact();
  const router = useRouter();
  const session = useSessionStatusRedirect(sessionId, "pre-submit");
  const deck = useDeck(session.data?.deck_id);
  const clipsList = useRecordingStore(() => recordingStore.list(sessionId));
  const clips = useMemo(() => new Map(clipsList), [clipsList]);
  const playback = useClipPlayback();
  const submit = useSubmitFlow(sessionId);
  const [warn, setWarn] = useState(false);
  useBeforeUnload(clips.size > 0);
  useEffect(() => () => { playback.stop(); }, [playback]);

  const slides = deck.data?.slides ?? [];
  const sugg = session.data?.suggested_seconds ?? [];
  const done = clips.size, miss = slides.length - done;
  const reRecord = (i: number) => { recordingStore.removeClip(sessionId, i); router.push(`/session/${sessionId}/room?slide=${i}`); };
  const run = () => { setWarn(false); void submit.submit(); };
  const f = submit.failure;
  const audioBad = f?.code === "audio_invalid" || f?.code === "clip_missing";
  return (
    <FlowShell step="mic">
      <Head title="Review and submit" sub="Play back or re-record any slide before you submit." />
      {session.isPending || deck.isPending ? <Skeleton h={300} r={16} /> : (
        <>
          {miss > 0 && <div style={{ marginBottom: 16 }}><Notice tone="warning">{miss} {miss === 1 ? "slide is" : "slides are"} not recorded yet. You can still submit, but those slides will be marked as skipped.</Notice></div>}
          <Card padding={0} aria-label="Recordings">
            <ol className={styles.list}>
              {slides.map((s, i) => {
                const c = clips.get(i), g = sugg[i] ?? 0, o = c && c.durationMs / 1000 > g;
                const pr = submit.progress.find((p) => p.slide === i);
                return (
                  <li key={i} className={styles.row}>
                    {!compact && <span className={styles.idx}>{i + 1}</span>}
                    <div>
                      <div className={styles.title}>{compact ? `${i + 1}. ` : ""}{s.title ?? `Slide ${i + 1}`}</div>
                      {compact && <Muted>{c ? `${mmss(c.durationMs / 1000)} of ${mmss(g)}` : "Not recorded"}</Muted>}
                      {pr && pr.state !== "waiting" && <div className={styles.up}><ProgressBar value={pr.pct} max={100} tone={pr.state === "failed" ? "danger" : pr.state === "done" ? "success" : "marine"} height={4} ariaLabel={`Uploading slide ${i + 1}`} valueLabel={pr.state === "failed" ? "Failed" : pr.state === "done" ? "Sent" : `${pr.pct}%`} /></div>}
                    </div>
                    {!compact && (c ? <Badge tone={o ? "warning" : "success"}>{mmss(c.durationMs / 1000)} / {mmss(g)}</Badge> : <Badge tone="warning">Not recorded</Badge>)}
                    <div className={styles.btns}>
                      {c && <IconButton icon={playback.playing === i ? "volume-2" : "play"} label={`Play back slide ${i + 1}`} variant="secondary" size={44} onClick={() => (playback.playing === i ? playback.stop() : playback.play(i, c.url))} disabled={submit.busy} />}
                      <IconButton icon={c ? "rotate-ccw" : "mic"} label={c ? `Re-record slide ${i + 1}` : `Record slide ${i + 1}`} variant="secondary" size={44} onClick={() => reRecord(i)} disabled={submit.busy} />
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
          <div className={styles.delete}><Icon name="trash-2" size={18} color="var(--bright-marine)" /><Muted>Audio is deleted once your report is generated. Your report keeps scores and transcripts only.</Muted></div>
          {submit.phase === "preparing" && <div className={styles.prep} role="status"><ProgressBar value={submit.prep.done} max={Math.max(1, submit.prep.total)} label="Preparing your recordings…" valueLabel={`${submit.prep.done} of ${submit.prep.total}`} /></div>}
          {f && f.ui && (
            <div className={styles.fail} data-testid="submit-error">
              <ErrorNotice title={f.ui.title} body={f.ui.body} onRetry={f.ui.retry && !audioBad ? () => void submit.retry() : undefined} />
              {audioBad && f.slideIndex !== null && <div style={{ marginTop: 10 }}><Button variant="secondary" onClick={() => reRecord(f.slideIndex!)}>Re-record slide {f.slideIndex + 1}</Button></div>}
            </div>
          )}
          <div className={styles.actions}>
            <Button size="lg" variant="secondary" disabled={submit.busy} onClick={() => router.push(`/session/${sessionId}/room`)}>Back to practice room</Button>
            <Button size="lg" iconLeft="sparkles" disabled={done === 0 || submit.busy} onClick={() => (miss ? setWarn(true) : run())}>{submit.busy ? "Submitting…" : "Submit for feedback"}</Button>
          </div>
        </>
      )}
      <Dialog open={warn} title="Submit with unrecorded slides?" onClose={() => setWarn(false)} width={440} actions={<><Button variant="secondary" onClick={() => setWarn(false)}>Go back</Button><Button onClick={run}>Submit anyway</Button></>}>
        <P>{miss} {miss === 1 ? "slide has" : "slides have"} no recording. Their key points will count as missed in your report.</P>
      </Dialog>
    </FlowShell>
  );
}
