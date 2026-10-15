// Microphone session + per-slide clip recorder. Recordings stay in memory only (no IndexedDB / localStorage).
import { AUDIO_SAMPLE_RATE } from "@shared/constants.ts";
import { pickMimeType } from "./capabilities";

/** Hard cap: 16 kHz mono 16-bit WAV is 32,000 bytes/s, so 600 s = 19.2 MB, just under the server's 20 MB per-clip limit. */
export const MAX_CLIP_SECONDS = 600;
export const MAX_CLIP_WAV_BYTES = 44 + MAX_CLIP_SECONDS * AUDIO_SAMPLE_RATE * 2; // must stay <= MAX_CLIP_BYTES
export const MAX_CLIP_MS = MAX_CLIP_SECONDS * 1000;

export type MicErrorKind = "denied" | "no_device" | "unsupported" | "busy" | "unknown";
export class MicError extends Error { constructor(public kind: MicErrorKind, message?: string) { super(message ?? kind); } }

export function classifyMicError(e: unknown): MicErrorKind {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "no_device";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  if (name === "TypeError") return "unsupported";
  return "unknown";
}

/** RMS of unsigned 8-bit time-domain samples → 0..1 (silence ≈ 0, loud speech ≈ 0.5+, scaled for the 28-bar meter). */
export function levelFromTimeDomain(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) { const v = (data[i]! - 128) / 128; sum += v * v; }
  return Math.min(1, Math.sqrt(sum / data.length) * 3.2);
}

export type Clip = { blob: Blob; mime: string; durationMs: number };

export class MicSession {
  private ctx: AudioContext;
  private analyser: AnalyserNode;
  private buf: Uint8Array<ArrayBuffer>;
  private smoothed = 0;
  private constructor(readonly stream: MediaStream, ctx: AudioContext, analyser: AnalyserNode) {
    this.ctx = ctx; this.analyser = analyser; this.buf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  }

  static async open(): Promise<MicSession> {
    if (!navigator.mediaDevices?.getUserMedia) throw new MicError("unsupported");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { throw new MicError(classifyMicError(e)); }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) { stream.getTracks().forEach((t) => t.stop()); throw new MicError("unsupported"); }
    const ctx = new Ctor();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    return new MicSession(stream, ctx, analyser);
  }

  /** Smoothed live level 0..1 (call roughly every 120 ms). */
  level(): number {
    this.analyser.getByteTimeDomainData(this.buf);
    const raw = levelFromTimeDomain(this.buf);
    this.smoothed = Math.max(0.04, this.smoothed * 0.4 + raw * 0.6);
    return this.smoothed;
  }

  get active(): boolean { return this.stream.getAudioTracks().some((t) => t.readyState === "live"); }

  startClip(onCap?: () => void): ClipRecorder { return new ClipRecorder(this.stream, onCap); }

  close() {
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close().catch(() => {});
  }
}

/** One MediaRecorder per slide clip. Duration comes from performance.now(), not interval ticks. */
export class ClipRecorder {
  private rec: MediaRecorder;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private capTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping: Promise<Clip> | null = null;
  readonly mime: string;

  constructor(stream: MediaStream, private onCap?: () => void) {
    this.mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t)) ?? "";
    this.rec = new MediaRecorder(stream, this.mime ? { mimeType: this.mime } : undefined);
    this.rec.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
  }

  start() {
    this.startedAt = performance.now();
    this.rec.start(250);
    this.capTimer = setTimeout(() => { this.onCap?.(); }, MAX_CLIP_MS);
  }

  elapsedMs() { return Math.round(performance.now() - this.startedAt); }

  stop(): Promise<Clip> {
    if (this.stopping) return this.stopping;
    if (this.capTimer) clearTimeout(this.capTimer);
    this.stopping = new Promise<Clip>((resolve, reject) => {
      const durationMs = Math.min(this.elapsedMs(), MAX_CLIP_MS);
      this.rec.onstop = () => {
        const type = this.rec.mimeType || this.mime || "audio/webm";
        resolve({ blob: new Blob(this.chunks, { type }), mime: type, durationMs });
      };
      this.rec.onerror = () => reject(new MicError("unknown", "recorder_error"));
      if (this.rec.state !== "inactive") this.rec.stop(); else this.rec.onstop?.(new Event("stop"));
    });
    return this.stopping;
  }
}
