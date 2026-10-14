"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Dialog } from "@/components/ds/Dialog";
import { Icon, type IconName } from "@/components/ds/Icon";
import { useToast } from "@/components/ds/Toast";
import { useCompact } from "@/components/app/Compact";
import { Logo } from "@/components/app/Logo";
import { LoadingShell } from "@/components/app/Loading";
import { Notice } from "@/components/app/Notice";
import { JURY, Person, SelfTile } from "@/components/app/Person";
import { SlideView } from "@/components/app/SlideView";
import { Overline, P } from "@/components/app/Typography";
import { useAuthSession } from "@/features/auth/queries";
import { useDeck, useSlideImages } from "@/features/decks/queries";
import { useBeforeUnload, useClipPlayback, useMicLevel } from "@/features/recording/hooks";
import { MAX_CLIP_SECONDS, MicError, MicSession, type ClipRecorder } from "@/features/recording/recorder";
import { recordingStore, useRecordingStore } from "@/features/recording/store";
import { useSessionStatusRedirect } from "@/features/sessions/queries";
import { mmss } from "@/lib/format";
import styles from "./Room.module.css";

type Status = "none" | "rec" | "done" | "over";
const STAT: Record<Status, { color: string; label: string }> = {
  none: { color: "var(--ink-400)", label: "Not recorded" }, rec: { color: "var(--danger-500)", label: "Recording" },
  done: { color: "var(--success-500)", label: "Recorded" }, over: { color: "var(--warning-500)", label: "Over time" },
};

function Ctl({ icon, label, onClick, disabled, kind, big, compact }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean; kind?: "rec" | "leave"; big?: boolean; compact: boolean }) {
  return (
    <button type="button" className={styles.ctl} disabled={disabled} onClick={onClick} aria-label={label === "Previous" ? "Previous slide" : label === "Next" ? "Next slide" : label === "End" ? "End session" : label} style={{ minWidth: compact ? 44 : 64 }}>
      <span className={`${styles.ctlIcon} ${kind ? styles[kind] : ""} ${big ? styles.big : ""}`} style={kind === "rec" && !disabled ? { boxShadow: "var(--shadow-record)" } : undefined}>
        <span style={{ display: "flex", transform: kind === "leave" ? "rotate(135deg)" : "none" }}><Icon name={icon} size={big ? 24 : 22} /></span>
      </span>
      <span aria-hidden="true">{label}</span>
    </button>
  );
}

/** S11 Practice room: dark full-bleed jury room, one recording per slide, live mic glow, timers that go red when over (never stop you). */
export function Room() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const compact = useCompact();
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const session = useSessionStatusRedirect(sessionId, "pre-submit");
  const deck = useDeck(session.data?.deck_id);
  const images = useSlideImages(session.data?.deck_id);
  const auth = useAuthSession();
  const mic = useRecordingStore(() => recordingStore.getMic());
  const clips = useRecordingStore(() => recordingStore.list(sessionId));
  const clipMap = useMemo(() => new Map(clips), [clips]);
  const slides = useMemo(() => deck.data?.slides ?? [], [deck.data]);
  const N = slides.length;
  const sugg = session.data?.suggested_seconds ?? [];

  const [cur, setCur] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [, tick] = useState(0);
  const [notes, setNotes] = useState(false);
  const [leave, setLeave] = useState(false);
  const [micErr, setMicErr] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const recRef = useRef<ClipRecorder | null>(null);
  const curRef = useRef(0);
  const overAnnounced = useRef(false);
  const playback = useClipPlayback();
  const level = useMicLevel(mic, recording);

  // initial slide: ?slide=n (re-record from Review) or the first slide without a clip
  useEffect(() => {
    if (cur !== null || !N) return;
    const q = Number(params.get("slide"));
    const first = Number.isInteger(q) && params.get("slide") !== null && q >= 0 && q < N ? q : Math.max(0, slides.findIndex((_, i) => !recordingStore.getClip(sessionId, i)));
    setCur(first);
  }, [N, cur, params, sessionId, slides]);
  const i = cur ?? 0;
  curRef.current = i;

  useEffect(() => { try { setNotes(localStorage.getItem("m2p.room.notes") === "1"); } catch { /* ignore */ } }, []);
  const toggleNotes = () => { const v = !notes; setNotes(v); try { localStorage.setItem("m2p.room.notes", v ? "1" : "0"); } catch { /* ignore */ } };

  // microphone: reuse the one granted at mic check, or open it again (e.g. after a refresh)
  useEffect(() => {
    if (recordingStore.getMic()?.active) return;
    let alive = true;
    MicSession.open().then((m) => { if (alive) recordingStore.setMic(m); else m.close(); }).catch((e) => { if (alive) setMicErr(e instanceof MicError ? e.kind : "unknown"); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (!recording) return; const t = setInterval(() => tick((x) => x + 1), 250); return () => clearInterval(t); }, [recording]);
  useBeforeUnload(recording || clips.length > 0);

  const elapsed = recording ? Math.floor((recRef.current?.elapsedMs() ?? 0) / 1000) : 0;
  const sg = sugg[i] ?? 0;
  const over = recording && elapsed > sg;
  useEffect(() => {
    if (over && !overAnnounced.current) { overAnnounced.current = true; setAnnounce("Over the suggested time for this slide. Keep going, wrap up when ready."); }
    if (!recording) overAnnounced.current = false;
  }, [over, recording]);

  const stopRec = useCallback(async (capped = false) => {
    const r = recRef.current; if (!r) return;
    recRef.current = null; setRecording(false);
    const slide = curRef.current;
    const clip = await r.stop();
    recordingStore.setClip(sessionId, slide, clip);
    setAnnounce(`Recording of slide ${slide + 1} saved`);
    if (capped) toast(`We stopped this recording at ${mmss(MAX_CLIP_SECONDS)}. That's the longest one slide can be.`, "warning");
  }, [sessionId, toast]);
  const startRec = useCallback(() => {
    const m = recordingStore.getMic();
    if (!m || recRef.current) return;
    playback.stop();
    const r = m.startClip(() => { void stopRec(true); });
    r.start(); recRef.current = r; setRecording(true);
    setAnnounce(`Recording slide ${curRef.current + 1}`);
  }, [playback, stopRec]);
  const rerecord = () => { recordingStore.removeClip(sessionId, i); startRec(); };
  const nav = useCallback((d: number) => { playback.stop(); setCur((c) => Math.max(0, Math.min(N - 1, (c ?? 0) + d))); }, [N, playback]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(input|textarea|select|button|a)$/i.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === " ") { e.preventDefault(); if (recording) void stopRec(); else if (!clipMap.get(curRef.current)) startRec(); }
      else if (!recording && e.key === "ArrowRight") nav(1);
      else if (!recording && e.key === "ArrowLeft") nav(-1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [recording, clipMap, nav, startRec, stopRec]);

  if (session.isPending || deck.isPending || cur === null) return <LoadingShell label="Opening the practice room" />;
  const clip = clipMap.get(i);
  const statusOf = (k: number): Status => (k === i && recording ? "rec" : clipMap.get(k) ? ((clipMap.get(k)!.durationMs / 1000) > (sugg[k] ?? 0) ? "over" : "done") : "none");
  const here = statusOf(i);
  const total = clips.reduce((a, [k, c]) => a + (k === i && recording ? 0 : c.durationMs / 1000), 0) + (recording ? elapsed : 0);
  const totalTarget = (session.data?.total_minutes ?? 0) * 60;
  const name = auth.data?.fullName ?? auth.data?.email ?? "You";
  const slide = slides[i];
  const goReview = () => router.push(`/session/${sessionId}/review`);
  const doLeave = () => { recordingStore.clearSession(sessionId); recordingStore.closeMic(); router.push("/dashboard"); };

  const timers: ReactNode = (
    <div className={styles.timers}>
      <div className={`${styles.pill} ${over ? styles.over : ""}`} data-testid="slide-timer" data-over={over ? "true" : "false"}><Icon name="timer" size={compact ? 14 : 16} />{mmss(recording ? elapsed : clip ? clip.durationMs / 1000 : 0)} <span className={styles.dim}>/ {mmss(sg)}</span></div>
      <div className={`${styles.pill} ${styles.pill2}`} data-testid="total-timer">{mmss(total)} <span className={styles.dim}>/ {mmss(totalTarget)}</span></div>
    </div>
  );
  const ctls = (
    <div className={styles.ctls} role="group" aria-label="Recording controls">
      <Ctl compact={compact} icon="chevron-left" label="Previous" disabled={recording || i === 0} onClick={() => nav(-1)} />
      <Ctl compact={compact} icon="mic" label="Record" kind="rec" big disabled={recording || !!clip || !mic} onClick={startRec} />
      <Ctl compact={compact} icon="square" label="Stop" disabled={!recording} onClick={() => void stopRec()} />
      <Ctl compact={compact} icon="play" label="Play back" disabled={recording || !clip} onClick={() => (playback.playing === i ? playback.stop() : clip && playback.play(i, clip.url))} />
      <Ctl compact={compact} icon="rotate-ccw" label="Re-record" disabled={recording || !clip} onClick={rerecord} />
      <Ctl compact={compact} icon="chevron-right" label="Next" disabled={recording || i === N - 1} onClick={() => nav(1)} />
      <Ctl compact={compact} icon="phone" label="End" kind="leave" onClick={() => setLeave(true)} />
    </div>
  );
  const stage = (
    <div className={styles.stage}>
      <SlideView src={images.urls.get(i)} alt={`Slide ${i + 1}: ${slide?.title ?? ""}`} onRefetch={images.refetch} />
      <div className={styles.status}>
        <div className={styles.statusL}>
          {recording ? <Badge tone="danger" dot>Recording slide {i + 1}</Badge> : playback.playing === i ? <Badge tone="info" dot>Playing back slide {i + 1}</Badge> : <Badge tone={here === "over" ? "warning" : here === "done" ? "success" : "neutral"}>{STAT[here].label}</Badge>}
          {over && <span className={styles.overText}>Over by {mmss(elapsed - sg)}. Keep going, wrap up when ready.</span>}
        </div>
        <span className={styles.hint}>{here === "none" && !recording ? "Take a breath. Press Record when ready." : ""}</span>
      </div>
      {playback.playing === i && <div className={styles.play} aria-hidden="true"><div style={{ width: `${playback.progress * 100}%` }} /></div>}
    </div>
  );
  const strip = (
    <div className={styles.strip} role="group" aria-label="Slides" tabIndex={0}>
      {slides.map((_, k) => { const s = statusOf(k); return (
        <button key={k} type="button" disabled={recording} aria-current={k === i ? "true" : undefined} aria-label={`Slide ${k + 1}, ${STAT[s].label}`} className={`${styles.chip} ${k === i ? styles.chipOn : ""}`} style={{ width: compact ? 76 : 112 }} onClick={() => { playback.stop(); setCur(k); }}>
          <SlideView src={images.urls.get(k)} alt="" flat radius={4} onRefetch={images.refetch} />
          <span className={styles.chipLabel}><i className={`${styles.dot} ${s === "rec" ? styles.pulse : ""}`} style={{ background: s === "none" ? "var(--ink-400)" : STAT[s].color }} />{compact ? k + 1 : STAT[s].label}</span>
        </button>
      ); })}
    </div>
  );
  const notesP = (
    <div className={styles.notes}>
      <button type="button" className={styles.notesBtn} aria-expanded={notes} onClick={toggleNotes}><span className={styles.notesTitle}><Icon name="notebook-pen" size={16} />My notes</span><Icon name={notes ? "chevron-up" : "chevron-down"} size={16} /></button>
      {notes && slide && <div className={styles.notesBody}><Overline color="var(--icy-blue)" style={{ marginBottom: 6 }}>Cover on this slide</Overline>{slide.key_points.map((k, x) => <div key={x} className={styles.note}><Icon name="circle-check" size={15} color="var(--icy-blue)" style={{ marginTop: 3 }} />{k}</div>)}</div>}
    </div>
  );
  const tiles = (small: boolean) => <>{JURY.map((a, k) => <Person key={k} k={k} label={a.name} role={a.role} small={small} />)}<SelfTile name={name} avatarUrl={auth.data?.avatarUrl} speaking={recording} level={level} small={small} /></>;

  return (
    <div className={styles.room}>
      <header className={styles.bar} style={{ height: compact ? 52 : 64, padding: compact ? "0 12px" : "0 24px" }}>
        {compact ? <div className={styles.barL}>Slide {i + 1}/{N}</div> : <div className={styles.barLeft}><Logo dark size={18} /><span className={styles.deckName}>{deck.data?.deck.title} · Slide {i + 1} of {N}</span></div>}
        {!compact && timers}
        {compact ? <div className={styles.barR}>Total {mmss(total)} / {mmss(totalTarget)}</div> : <Button variant="inverse" size="sm" disabled={recording} onClick={goReview}>Review and submit</Button>}
      </header>
      <div className="sr-only" role="status" aria-live="polite" data-testid="room-announce">{announce}</div>
      {micErr && <div className={styles.micErr}><Notice tone="danger" title="We can't use your microphone" action={<Button size="sm" variant="secondary" onClick={() => router.push(`/session/${sessionId}/mic`)}>Mic check</Button>}>Go back to the mic check to allow it, then return here.</Notice></div>}
      <h1 className="sr-only">Practice room</h1>
      {compact ? (
        <>
          <main id="main" className={styles.mBody}>{stage}<div className={styles.mTiles}>{tiles(true)}</div>{strip}{notesP}<Button variant="inverse" disabled={recording} onClick={goReview}>Review and submit</Button></main>
          <div className={styles.sheet}><div className={styles.sheetTimers}>{timers}</div>{ctls}</div>
        </>
      ) : (
        <>
          <main id="main" className={styles.body}>
            <div className={styles.left}>{stage}{strip}</div>
            <aside className={styles.rail} aria-label="Jury"><div className={styles.tiles}>{tiles(false)}</div>{notesP}</aside>
          </main>
          <div className={styles.dockWrap}><div className={styles.dock}>{ctls}</div></div>
        </>
      )}
      <Dialog open={leave} title="Leave this session?" onClose={() => setLeave(false)} width={440}
        actions={<><Button variant="secondary" onClick={() => setLeave(false)}>Keep practising</Button><Button variant="record" onClick={doLeave}>Leave session</Button></>}>
        <P>Your recordings for this session will be discarded and no report will be created.</P>
      </Dialog>
    </div>
  );
}
