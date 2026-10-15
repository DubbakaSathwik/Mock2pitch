"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { suggestedSeconds } from "@shared/scoring.ts";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { Tabs } from "@/components/ds/Tabs";
import { AIBadge } from "@/components/app/AIBadge";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { FlowShell, Head } from "@/components/app/shells";
import { SlideView } from "@/components/app/SlideView";
import { Muted, Overline, P } from "@/components/app/Typography";
import { useDeck, useSlideImages } from "@/features/decks/queries";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import styles from "./Prep.module.css";

/** S8 Slide prep: study material only (thumb rail, slide, key points, suggested script). ←/→ change slide. */
export function Prep() {
  const { deckId } = useParams<{ deckId: string }>();
  const compact = useCompact();
  const router = useRouter();
  const deck = useDeck(deckId);
  const images = useSlideImages(deckId, deck.data?.deck.status === "ready");
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState("kp");
  const slides = deck.data?.slides ?? [];
  useEffect(() => { if (deck.data && deck.data.deck.status !== "ready") router.replace(`/practice/${deckId}/reading`); }, [deck.data, deckId, router]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (e.key === "ArrowRight") setSel((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === "ArrowLeft") setSel((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [slides.length]);
  const ui = deck.error ? errorUi(toAppError(deck.error).code) : null;
  const s = slides[sel];
  const secs = slides.length ? suggestedSeconds(5, slides.map((x) => x.time_weight))[sel] ?? 0 : 0;
  const next = () => router.push(`/practice/${deckId}/time`);

  const kp = s && (
    <Card padding={20} aria-label="Key points">
      <div className={styles.cardHead}><Overline>Key points to cover</Overline><AIBadge /></div>
      <ul className={styles.kpList}>{s.key_points.map((k, x) => <li key={x}><Icon name="circle-check" size={18} color="var(--bright-marine)" style={{ marginTop: 3 }} />{k}</li>)}</ul>
    </Card>
  );
  const script = s && (
    <Card padding={20} aria-label="Suggested script">
      <div className={styles.cardHead}><Overline>Suggested script</Overline><AIBadge /></div>
      <P style={{ fontSize: 15 }}>{s.suggested_script}</P>
      <Muted style={{ marginTop: 10 }}>About {secs} seconds in a 5 minute run.</Muted>
    </Card>
  );
  const thumbs = slides.map((sl, x) => (
    <button key={x} type="button" className={`${styles.thumb} ${x === sel ? styles.thumbOn : ""}`} aria-current={x === sel ? "true" : undefined} aria-label={`Slide ${x + 1}${sl.title ? `: ${sl.title}` : ""}`} onClick={() => setSel(x)}>
      <SlideView src={images.urls.get(x)} alt="" flat={false} style={{ boxShadow: "var(--shadow-sm)" }} onRefetch={images.refetch} />
      <Muted as="span" style={{ fontSize: 12, marginTop: 4, display: "block" }}>Slide {x + 1}</Muted>
    </button>
  ));
  return (
    <FlowShell step="prep" wide>
      <Head title="Prepare your slides" sub="Study material only. Your slides stay exactly as you uploaded them." right={!compact && <Button iconRight="arrow-right" onClick={next}>Continue to set time</Button>} />
      {deck.isPending ? <Skeleton h={360} r={16} /> : ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => deck.refetch()} />
        : !s ? <Muted>No slides were found for this deck.</Muted>
        : compact ? (
          <div className={styles.mobile}>
            <SlideView src={images.urls.get(sel)} alt={`Slide ${sel + 1}: ${s.title ?? ""}`} onRefetch={images.refetch} />
            <div className={styles.hscroll}>{thumbs}</div>
            <Tabs variant="pill" items={[{ value: "kp", label: "Key points" }, { value: "sc", label: "Script" }]} value={tab} onChange={setTab} label="Study notes" />
            {tab === "kp" ? kp : script}
            <Button fullWidth size="lg" onClick={next}>Continue to set time</Button>
          </div>
        ) : (
          <div className={styles.desktop}>
            <div className={styles.rail}>{thumbs}</div>
            <div>
              <SlideView src={images.urls.get(sel)} alt={`Slide ${sel + 1}: ${s.title ?? ""}`} onRefetch={images.refetch} />
              <div className={styles.nav}>
                <Button variant="ghost" size="sm" disabled={sel === 0} iconLeft="chevron-left" onClick={() => setSel(sel - 1)}>Previous</Button>
                <Muted as="span">Slide {sel + 1} of {slides.length}</Muted>
                <Button variant="ghost" size="sm" disabled={sel === slides.length - 1} iconRight="chevron-right" onClick={() => setSel(sel + 1)}>Next</Button>
              </div>
            </div>
            <div className={styles.right}>{kp}{script}</div>
          </div>
        )}
    </FlowShell>
  );
}
