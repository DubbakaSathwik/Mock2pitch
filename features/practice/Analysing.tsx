"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ds/Button";
import { useCompact } from "@/components/app/Compact";
import { errorUi } from "@/features/errors/map";
import { useWatch } from "@/features/realtime/useWatch";
import { getData } from "@/lib/data";
import { toAppError } from "@/lib/data/errors";
import type { SessionEvent } from "@/lib/data/types";
import { qk } from "@/lib/query";
import styles from "./Analysing.module.css";

type Info = SessionEvent & { deck_id: string };

/** Progress 0–100 from the contract's stage strings: "Transcribing your recording" → "Transcribed k of m" → "Writing your report". */
export function analysisProgress(stage: string | null, status: string): number {
  if (status === "completed") return 100;
  if (stage === "Writing your report" || status === "generating_report") return 82;
  const m = stage?.match(/^Transcribed (\d+) of (\d+)$/);
  if (m) return 12 + (Number(m[1]) / Math.max(1, Number(m[2]))) * 60;
  return 8;
}

/** S13 Analysing: calm full-screen wait (30–60 s on the real backend). Survives a refresh because it re-reads the session status. */
export function Analysing() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const compact = useCompact();
  const router = useRouter();
  const qc = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [retryErr, setRetryErr] = useState<string | null>(null);
  const { value: s, error } = useWatch<Info>(`${sessionId}:${attempt}`, () => ({
    subscribe: (cb) => getData().realtime.subscribeSession(sessionId, (e) => cb({ ...e, deck_id: "" })),
    fetch: () => getData().sessions.get(sessionId),
  }));

  useEffect(() => {
    if (s?.status === "completed" && s.report_id) {
      void qc.invalidateQueries({ queryKey: qk.decks }); void qc.invalidateQueries({ queryKey: qk.stats }); void qc.invalidateQueries({ queryKey: ["dashboard"] });
      router.replace(`/reports/${s.report_id}`);
    }
    if (s?.status === "in_progress") router.replace(`/session/${sessionId}/review`);
  }, [s, sessionId, qc, router]);

  const retry = async () => {
    setBusy(true); setRetryErr(null);
    try { await getData().sessions.analyse(sessionId); setAttempt((a) => a + 1); }
    catch (e) { const err = toAppError(e); const ui = errorUi(err.code, err.details); setRetryErr(ui.kind === "inline" ? `${ui.title}. ${ui.body}` : "Please try again."); }
    finally { setBusy(false); }
  };

  const failed = s?.status === "failed" || s?.status === "uploading_audio";
  const code = s?.error_code ?? null;
  const ui = failed && code ? errorUi(code as never) : null;
  const pct = s ? analysisProgress(s.analysis_stage, s.status) : 8;

  return (
    <main id="main" className={styles.page}>
      <div className={styles.box}>
        {failed ? (
          <div role="alert" data-testid="analysis-failed">
            <h1 className={styles.title} style={{ fontSize: compact ? 26 : 32 }}>{code === "audio_invalid" ? "One recording couldn't be read" : code === "max_attempts" ? "We couldn't finish this report" : (code === "ai_unavailable" || code === "AI_BUSY") ? "Our AI is busy right now" : "We couldn't finish your report"}</h1>
            <p className={styles.text}>{ui?.kind === "inline" ? ui.body : s?.status === "uploading_audio" ? "Your recordings were sent but the analysis didn't start. Try again." : "Your recordings are safe. Try again."}</p>
            {retryErr && <p className={styles.err}>{retryErr}</p>}
            <div className={styles.btns}>
              {code === "audio_invalid" ? <Link href={`/session/${sessionId}/review`}><Button variant="inverse">Back to review</Button></Link>
                : code === "max_attempts" ? <Link href="/dashboard"><Button variant="inverse">Back to dashboard</Button></Link>
                : <Button variant="inverse" disabled={busy} onClick={() => void retry()}>{busy ? "Trying again…" : "Try again"}</Button>}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.spinner} aria-hidden="true" />
            <h1 className={styles.title} style={{ fontSize: compact ? 26 : 32 }}>Nice work. Reading your session…</h1>
            <p className={styles.text} aria-live="polite" data-testid="analysis-stage">{s?.analysis_stage ?? "Transcribing your recording"}. Your audio will be deleted when this finishes.</p>
            {error && <p className={styles.err}>We lost the connection. We&apos;ll keep trying.</p>}
            <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="Analysis progress"><div className={styles.fill} style={{ width: `${pct}%` }} /></div>
          </>
        )}
      </div>
    </main>
  );
}
