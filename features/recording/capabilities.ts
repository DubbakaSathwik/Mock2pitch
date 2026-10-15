// Feature detection for the practice flow. Unsupported browsers get a clear message instead of a crash.
export type Capabilities = { getUserMedia: boolean; mediaRecorder: boolean; audioContext: boolean; offlineAudioContext: boolean; chromium: boolean };

export const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"] as const;

/** First supported MediaRecorder mime type (webm/opus on Chromium and Firefox, mp4/aac on Safari). */
export function pickMimeType(isTypeSupported: (t: string) => boolean): string | undefined {
  return MIME_CANDIDATES.find((t) => isTypeSupported(t));
}

/** Chromium-based desktop/Android browsers (Chrome, Edge, Opera). iOS "Chrome" (CriOS) is WebKit and does not count. */
export function isChromiumUserAgent(ua: string): boolean {
  return /(Chrome|Chromium|Edg)\//.test(ua);
}

export function detectCapabilities(env: { navigator?: Navigator; w?: Record<string, unknown> } = {}): Capabilities {
  const nav = env.navigator ?? (typeof navigator !== "undefined" ? navigator : undefined);
  const w = (env.w ?? (typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : {})) as Record<string, unknown>;
  return {
    getUserMedia: !!nav?.mediaDevices?.getUserMedia,
    mediaRecorder: typeof w.MediaRecorder === "function",
    audioContext: typeof w.AudioContext === "function" || typeof w.webkitAudioContext === "function",
    offlineAudioContext: typeof w.OfflineAudioContext === "function",
    chromium: isChromiumUserAgent(nav?.userAgent ?? ""),
  };
}

export const recordingSupported = (c: Capabilities) => c.getUserMedia && c.mediaRecorder && c.audioContext;
