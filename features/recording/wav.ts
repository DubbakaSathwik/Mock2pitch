// Browser-side audio conversion to exactly what the server accepts: 16 kHz, mono, 16-bit PCM WAV (RIFF, 44-byte header).
import { AUDIO_BITS, AUDIO_CHANNELS, AUDIO_SAMPLE_RATE } from "@shared/constants.ts";

/** Pure encoder: float samples in [-1, 1] → 16-bit PCM WAV bytes. */
export function encodeWav(samples: Float32Array, sampleRate = AUDIO_SAMPLE_RATE): Uint8Array {
  const bytesPerSample = AUDIO_BITS / 8;
  const dataBytes = samples.length * bytesPerSample;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + dataBytes, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, AUDIO_CHANNELS, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * AUDIO_CHANNELS * bytesPerSample, true);
  v.setUint16(32, AUDIO_CHANNELS * bytesPerSample, true); v.setUint16(34, AUDIO_BITS, true);
  str(36, "data"); v.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return new Uint8Array(buf);
}

/** Average all channels into one. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]!;
  const n = channels[0]?.length ?? 0;
  const out = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) out[i]! += c[i]! / channels.length;
  return out;
}

/** Linear-interpolation resampler (fallback when OfflineAudioContext is unavailable; also used by tests). */
export function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const outLen = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  const ratio = (input.length - 1) / Math.max(1, outLen - 1);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio, i0 = Math.floor(pos), i1 = Math.min(input.length - 1, i0 + 1), f = pos - i0;
    out[i] = input[i0]! * (1 - f) + input[i1]! * f;
  }
  return out;
}

export const wavDurationMs = (wav: Uint8Array) => Math.round(((wav.length - 44) / 2 / AUDIO_SAMPLE_RATE) * 1000);

type AC = typeof AudioContext;
const audioCtor = (): AC | undefined => (globalThis as unknown as { AudioContext?: AC; webkitAudioContext?: AC }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AC }).webkitAudioContext;

/** Decode a recorded clip (webm/opus, mp4/aac, …), downmix to mono, resample to 16 kHz with an OfflineAudioContext, encode WAV. */
export async function clipToWav16kMono(blob: Blob): Promise<Uint8Array> {
  const Ctor = audioCtor();
  if (!Ctor) throw new Error("audio_unsupported");
  const ctx = new Ctor();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    let mono: Float32Array;
    if (typeof OfflineAudioContext !== "undefined") {
      const frames = Math.max(1, Math.ceil(decoded.duration * AUDIO_SAMPLE_RATE));
      const off = new OfflineAudioContext(1, frames, AUDIO_SAMPLE_RATE);
      const src = off.createBufferSource();
      src.buffer = decoded; src.connect(off.destination); src.start();
      mono = (await off.startRendering()).getChannelData(0);
    } else {
      const chans = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
      mono = resampleLinear(downmixToMono(chans), decoded.sampleRate, AUDIO_SAMPLE_RATE);
    }
    return encodeWav(mono);
  } finally { void ctx.close(); }
}
