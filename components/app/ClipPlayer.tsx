"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ds/IconButton";
import { clipToWav16kMono } from "@/features/recording/wav";
import { mmss } from "@/lib/format";
import styles from "./ClipPlayer.module.css";

/** Only one clip plays at a time: starting one pauses the one that was playing. */
let pauseActive: (() => void) | null = null;

export type ClipPlayerProps = {
  /** The recording as captured (MediaRecorder output) and its object URL. */
  blob: Blob; url: string;
  /** Length measured while recording; shown until the audio reports its own. */
  durationMs: number;
  playLabel: string; pauseLabel: string; seekLabel: string;
  disabled?: boolean;
};

/**
 * Play / pause, a draggable seek bar (click, drag or use the arrow keys) and "0:12 / 1:09".
 * MediaRecorder files often have no length and cannot be seeked reliably, so on first play the clip is re-wrapped as a small WAV
 * (the same conversion used when submitting) and that is what plays; if the conversion fails the original file is played.
 */
export function ClipPlayer({ blob, url, durationMs, playLabel, pauseLabel, seekLabel, disabled }: ClipPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(Math.max(0.1, durationMs / 1000));
  const [preparing, setPreparing] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const wavUrl = useRef<string | null>(null);
  const pending = useRef<number | null>(null); // a seek made before the audio exists
  const dragging = useRef(false);
  const alive = useRef(true);

  const ensure = useCallback(async (): Promise<HTMLAudioElement> => {
    if (audio.current) return audio.current;
    setPreparing(true);
    let src = url;
    try {
      const wav = await clipToWav16kMono(blob);
      wavUrl.current = URL.createObjectURL(new Blob([wav as BlobPart], { type: "audio/wav" }));
      src = wavUrl.current;
    } catch { /* play the original file */ }
    const a = new Audio(src);
    a.onloadedmetadata = () => { if (Number.isFinite(a.duration) && a.duration > 0) setDur(a.duration); if (pending.current != null) { a.currentTime = pending.current; pending.current = null; } };
    a.ontimeupdate = () => { if (!dragging.current) setPos(a.currentTime); };
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.onended = () => { setPlaying(false); setPos(0); a.currentTime = 0; };
    a.onerror = () => setPlaying(false);
    audio.current = a;
    if (alive.current) setPreparing(false);
    return a;
  }, [blob, url]);

  const toggle = async () => {
    if (playing) { audio.current?.pause(); return; }
    const a = await ensure();
    if (pauseActive && pauseActive !== a.pause.bind(a)) pauseActive();
    pauseActive = () => a.pause();
    try { await a.play(); } catch { setPlaying(false); }
  };

  const seek = (v: number) => {
    setPos(v);
    if (audio.current) audio.current.currentTime = v;
    else pending.current = v;
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      audio.current?.pause(); audio.current = null;
      if (wavUrl.current) { URL.revokeObjectURL(wavUrl.current); wavUrl.current = null; }
      pauseActive = null;
    };
  }, []);

  const pct = dur > 0 ? Math.min(100, (pos / dur) * 100) : 0;
  return (
    <div className={styles.player}>
      <IconButton icon={playing ? "pause" : "play"} label={playing ? pauseLabel : playLabel} variant="secondary" size={44} disabled={disabled || preparing} onClick={() => void toggle()} />
      <input
        type="range" className={styles.seek} min={0} max={dur} step={0.1} value={Math.min(pos, dur)} disabled={disabled}
        aria-label={seekLabel} aria-valuetext={`${mmss(pos)} of ${mmss(dur)}`}
        style={{ ["--p" as string]: `${pct}%` }}
        onPointerDown={() => { dragging.current = true; }}
        onPointerUp={() => { dragging.current = false; }}
        onBlur={() => { dragging.current = false; }}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <span className={styles.time} aria-hidden="true">{mmss(pos)} / {mmss(dur)}</span>
    </div>
  );
}
