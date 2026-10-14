"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ds/Button";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { AIBadge } from "@/components/app/AIBadge";
import { useCompact } from "@/components/app/Compact";
import { ErrorNotice, Notice } from "@/components/app/Notice";
import { FlowShell } from "@/components/app/shells";
import { SlideView } from "@/components/app/SlideView";
import { H, Muted, P } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { useSlideImages } from "@/features/decks/queries";
import { useWatch } from "@/features/realtime/useWatch";
import { getData } from "@/lib/data";
import { toAppError } from "@/lib/data/errors";
import type { DeckEvent } from "@/lib/data/types";
import { qk } from "@/lib/query";
import styles from "./Reading.module.css";

/** S7 Reading slides: realtime stage text, progress and thumbnails appearing as each slide finishes; auto-advances on `ready`. */
export function Reading() {
  const { deckId } = useParams<{ deckId: string }>();
  const compact = useCompact();
  const router = useRouter();
  const qc = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryErr, setRetryErr] = useState<ReturnType<typeof toAppError> | null>(null);
  const { value: deck, error } = useWatch<DeckEvent>(`${deckId}:${attempt}`, () => ({
    subscribe: (cb) => getData().realtime.subscribeDeck(deckId, cb),
    fetch: () => getData().decks.getStatus(deckId),
  }));
  const total = deck?.page_count ?? 0;
  const images = useSlideImages(deckId, total > 0);
  useEffect(() => {
    if (deck?.status === "ready") { void qc.invalidateQueries({ queryKey: qk.decks }); router.replace(`/practice/${deckId}/prepare`); }
  }, [deck?.status, deckId, qc, router]);

  const retry = async () => {
    setRetrying(true); setRetryErr(null);
    try { await getData().upload.process(deckId); setAttempt((a) => a + 1); }
    catch (e) { setRetryErr(toAppError(e)); }
    finally { setRetrying(false); }
  };

  const failed = deck?.status === "failed";
  const unfinished = deck && (deck.status === "awaiting_upload" || deck.status === "awaiting_images" || (failed && !deck.page_count));
  const processed = deck?.processed_slides ?? 0;
  const stage = deck?.processing_stage ?? "Waiting for slide images";
  const ui = failed && deck?.error_code ? errorUi(deck.error_code as never) : null;
  const retryUi = retryErr ? errorUi(retryErr.code, retryErr.details) : null;
  return (
    <FlowShell step="upload">
      <div className={styles.wrap} style={{ paddingTop: compact ? 8 : 40 }}>
        <div className={styles.badge}><AIBadge>AI is reading your slides</AIBadge></div>
        <H l={1}><span aria-live="polite">{failed || unfinished ? "We couldn't finish reading" : `${stage}…`}</span></H>
        <P style={{ margin: "8px 0 24px" }}>{failed || unfinished ? "Nothing extra was used up." : "This takes a few seconds."}</P>
        {error && <div className={styles.msg}><ErrorNotice title="We lost the connection" body="Check your connection. We'll keep trying." /></div>}
        {failed && !unfinished && ui?.kind === "inline" && <div className={styles.msg}><ErrorNotice title={ui.title} body={ui.body} onRetry={retrying ? undefined : () => void retry()} /></div>}
        {failed && !unfinished && ui?.kind !== "inline" && <div className={styles.msg}><ErrorNotice title="Something went wrong" body="Please try again." onRetry={() => void retry()} /></div>}
        {retryUi?.kind === "inline" && <div className={styles.msg}><Notice tone="danger" title={retryUi.title}>{retryUi.body}</Notice></div>}
        {unfinished && (
          <div className={styles.msg}>
            <Notice tone="warning" title="This upload didn't finish">Start over with your PDF. Your daily sessions were not used up unless the upload completed.</Notice>
            <div style={{ marginTop: 14 }}><Link href="/practice/new"><Button>Upload again</Button></Link></div>
          </div>
        )}
        {!failed && !unfinished && (
          <div className={styles.bar}><ProgressBar value={processed} max={Math.max(total, 1)} ariaLabel="Slides read" valueLabel={total ? `${processed} of ${total}` : undefined} /></div>
        )}
        {total > 0 && (
          <ul className={styles.thumbs}>
            {Array.from({ length: total }, (_, i) => (
              <li key={i} className={i < processed ? styles.in : styles.out}>
                <SlideView src={i < processed ? images.urls.get(i) : null} alt={`Slide ${i + 1}`} onRefetch={images.refetch} />
                <Muted style={{ marginTop: 6 }}>Slide {i + 1}</Muted>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FlowShell>
  );
}
