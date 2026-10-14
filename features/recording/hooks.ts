"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MicSession } from "./recorder";

/** Live microphone level 0..1 sampled every ~120 ms while `active`. */
export function useMicLevel(mic: MicSession | null, active: boolean): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!mic || !active) { setLevel(0); return; }
    const t = setInterval(() => setLevel(mic.level()), 120);
    return () => clearInterval(t);
  }, [mic, active]);
  return level;
}

/** Warns before the tab closes/reloads while unsubmitted recordings exist. */
export function useBeforeUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active]);
}

/** Plays a recorded clip (object URL). `progress` is 0..1; `playing` is the clip key being played (or null). */
export function useClipPlayback() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | number | null>(null);
  const [progress, setProgress] = useState(0);
  const stop = useCallback(() => { audio.current?.pause(); audio.current = null; setPlaying(null); setProgress(0); }, []);
  const play = useCallback((key: string | number, url: string) => {
    audio.current?.pause();
    const a = new Audio(url);
    audio.current = a;
    setPlaying(key); setProgress(0);
    a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
    a.onended = () => { setPlaying(null); setProgress(0); audio.current = null; };
    a.onerror = () => { setPlaying(null); audio.current = null; };
    void a.play().catch(() => { setPlaying(null); });
  }, []);
  useEffect(() => () => { audio.current?.pause(); }, []);
  return { playing, progress, play, stop };
}
