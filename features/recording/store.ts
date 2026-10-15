"use client";
// In-memory recording store shared by Mic check → Practice room → Review. Nothing is persisted (no IndexedDB / localStorage):
// a refresh loses the clips, which is why the room and review warn before leaving.
import { useSyncExternalStore } from "react";
import type { Clip, MicSession } from "./recorder";

export type StoredClip = Clip & { url: string };

const clips = new Map<string, Map<number, StoredClip>>();
let mic: MicSession | null = null;
let version = 0;
const listeners = new Set<() => void>();
const bump = () => { version++; listeners.forEach((l) => l()); };

export const recordingStore = {
  subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; },
  version: () => version,
  getClip(sessionId: string, slide: number): StoredClip | undefined { return clips.get(sessionId)?.get(slide); },
  list(sessionId: string): [number, StoredClip][] { return [...(clips.get(sessionId)?.entries() ?? [])].sort((a, b) => a[0] - b[0]); },
  setClip(sessionId: string, slide: number, clip: Clip) {
    let m = clips.get(sessionId);
    if (!m) clips.set(sessionId, (m = new Map()));
    const old = m.get(slide);
    if (old) URL.revokeObjectURL(old.url);
    m.set(slide, { ...clip, url: URL.createObjectURL(clip.blob) });
    bump();
  },
  removeClip(sessionId: string, slide: number) {
    const old = clips.get(sessionId)?.get(slide);
    if (old) URL.revokeObjectURL(old.url);
    clips.get(sessionId)?.delete(slide);
    bump();
  },
  clearSession(sessionId: string) {
    for (const c of clips.get(sessionId)?.values() ?? []) URL.revokeObjectURL(c.url);
    clips.delete(sessionId);
    bump();
  },
  hasClips(): boolean { for (const m of clips.values()) if (m.size) return true; return false; },
  getMic: () => mic,
  setMic(m: MicSession | null) { if (mic && mic !== m) mic.close(); mic = m; bump(); },
  closeMic() { mic?.close(); mic = null; bump(); },
  /** Test helper. */
  reset() { for (const id of [...clips.keys()]) recordingStore.clearSession(id); mic?.close(); mic = null; bump(); },
};

export function useRecordingStore<T>(select: () => T): T {
  useSyncExternalStore(recordingStore.subscribe, recordingStore.version, recordingStore.version);
  return select();
}
