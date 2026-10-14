"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { useToast } from "@/components/ds/Toast";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { Head, StudentShell } from "@/components/app/shells";
import { Star } from "@/components/app/Stars";
import { Tile } from "@/components/app/Tile";
import { H, Muted, P } from "@/components/app/Typography";
import { useDecks, usePinDeck } from "@/features/decks/queries";
import { useStartPractice } from "@/features/dashboard/useStartPractice";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { formatDate, plural } from "@/lib/format";
import { scoreColor } from "@/lib/score";
import styles from "./History.module.css";

/** S15 History: deck cards, pinned decks first. */
export function History() {
  const compact = useCompact();
  const router = useRouter();
  const { toast } = useToast();
  const decks = useDecks();
  const pin = usePinDeck();
  const start = useStartPractice();
  const onPin = (deckId: string, pinned: boolean) =>
    pin.mutate({ deckId, pinned }, {
      onSuccess: () => toast(pinned ? "Deck pinned to top" : "Deck unpinned"),
      onError: (e) => { const code = toAppError(e).code; toast(code === "blocked" ? "Your account is paused." : "We couldn't update that. Try again.", "danger"); },
    });
  const ui = decks.error ? errorUi(toAppError(decks.error).code) : null;
  return (
    <StudentShell active="history">
      <Head title="History" sub="Your reports, grouped by deck. Audio is never kept." />
      {decks.isPending ? <Card padding={24}><Skeleton h={48} /></Card>
        : ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => decks.refetch()} />
        : (decks.data ?? []).length === 0 ? (
          <Card padding={compact ? 28 : 56} className={styles.empty}>
            <div className={styles.tileRow}><Tile icon="history" size={56} /></div>
            <H l={2}>No reports yet</H>
            <P style={{ margin: "8px 0 18px" }}>Your reports will show up here after your first practice.</P>
            <Button disabled={start.blocked} onClick={() => router.push(start.href)}>Start a new practice</Button>
            {start.blocked && <Muted style={{ marginTop: 10 }}>Your account is paused, so new practice is unavailable.</Muted>}
          </Card>
        ) : (
          <ul className={styles.list}>
            {(decks.data ?? []).map((d) => (
              <li key={d.deck_id} className={styles.row} data-testid="deck-row">
                <Card padding={0} interactive className={styles.card}>
                  <div className={styles.inner}>
                    <Tile icon="presentation" size={48} />
                    <div className={styles.info}>
                      <div className={styles.title}>
                        <Link href={`/history/${d.deck_id}`} className={styles.link}>{d.title}</Link>
                        {d.pinned && <Badge tone="warning">Pinned</Badge>}
                      </div>
                      <Muted>{d.page_count} slides · {plural(d.attempts_count, "attempt")}{d.latest_attempt_at ? ` · last on ${formatDate(d.latest_attempt_at)}` : ""}</Muted>
                    </div>
                    <button type="button" className={`${styles.pin} ${d.pinned ? styles.pinOn : ""}`} aria-pressed={d.pinned} aria-label={d.pinned ? `Unpin ${d.title}` : `Pin ${d.title}`} title={d.pinned ? "Unpin" : "Pin to top"} onClick={() => onPin(d.deck_id, !d.pinned)}><Star on={d.pinned} size={22} /></button>
                    <div className={styles.score} style={{ color: d.latest_score === null ? "var(--ink-400)" : scoreColor(d.latest_score) }}>{d.latest_score ?? "–"}{d.latest_score !== null && <span className={styles.latest}>latest</span>}</div>
                    {!compact && <Icon name="chevron-right" size={20} color="var(--ink-400)" />}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </StudentShell>
  );
}
