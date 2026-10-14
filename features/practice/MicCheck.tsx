"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { useCompact } from "@/components/app/Compact";
import { MicMeter, levelLabel } from "@/components/app/MicMeter";
import { Notice } from "@/components/app/Notice";
import { FlowShell, Head } from "@/components/app/shells";
import { Tile } from "@/components/app/Tile";
import { H, Muted, P } from "@/components/app/Typography";
import type { IconName } from "@/components/ds/Icon";
import { detectCapabilities, recordingSupported, type Capabilities } from "@/features/recording/capabilities";
import { useMicLevel } from "@/features/recording/hooks";
import { MicError, MicSession, type MicErrorKind } from "@/features/recording/recorder";
import { recordingStore, useRecordingStore } from "@/features/recording/store";
import { useSessionStatusRedirect } from "@/features/sessions/queries";
import styles from "./MicCheck.module.css";

type State = "idle" | "requesting" | "granted" | MicErrorKind;

const CHECKLIST: [IconName, string][] = [["volume-x", "Find a quiet room"], ["message-circle", "Speak naturally, as you would to a jury"], ["circle-dot", "Each slide is a separate recording"], ["rotate-ccw", "You can re-record any slide before you submit"]];

/** S10 Mic check: idle / requesting / granted (live meter) / denied / no device / unsupported. */
export function MicCheck() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const compact = useCompact();
  const router = useRouter();
  useSessionStatusRedirect(sessionId, "pre-submit");
  const mic = useRecordingStore(() => recordingStore.getMic());
  const [state, setState] = useState<State>(() => (recordingStore.getMic()?.active ? "granted" : "idle"));
  const [caps, setCaps] = useState<Capabilities | null>(null);
  useEffect(() => { setCaps(detectCapabilities()); }, []);
  const level = useMicLevel(mic, state === "granted");
  const supported = !caps || recordingSupported(caps);

  const open = async () => {
    setState("requesting");
    try { recordingStore.setMic(await MicSession.open()); setState("granted"); }
    catch (e) { setState(e instanceof MicError ? e.kind : "unknown"); }
  };

  return (
    <FlowShell step="mic">
      <Head title="Mic check" sub="Like a meeting green room. Test your microphone before you enter." />
      {caps && !caps.chromium && <div style={{ marginBottom: 16 }}><Notice tone="info">Use Chrome for the best results. Other browsers can record, but we test most on Chrome.</Notice></div>}
      <div className={styles.grid}>
        <Card>
          {!supported || state === "unsupported" ? (
            <div><div className={styles.head}><Tile icon="mic-off" /><div><H l={3}>This browser can&apos;t record audio</H><P style={{ fontSize: 15 }}>Open Mock2Pitch in the latest Chrome, Edge or Safari to practise.</P></div></div></div>
          ) : state === "denied" ? (
            <div>
              <div className={styles.head}><Tile icon="mic-off" /><div><H l={3}>Microphone access is blocked</H><P style={{ fontSize: 15 }}>We can&apos;t hear you yet. This takes about 30 seconds to fix.</P></div></div>
              <ol className={styles.steps}><li>Click the lock icon next to the web address.</li><li>Set Microphone to Allow.</li><li>Reload this page, or press Try again.</li></ol>
              <Button onClick={() => void open()}>Try again</Button>
            </div>
          ) : state === "no_device" ? (
            <div>
              <div className={styles.head}><Tile icon="mic-off" /><div><H l={3}>We can&apos;t find a microphone</H><P style={{ fontSize: 15 }}>Plug in a headset or check your device settings, then try again.</P></div></div>
              <Button onClick={() => void open()}>Try again</Button>
            </div>
          ) : state === "busy" || state === "unknown" ? (
            <div>
              <div className={styles.head}><Tile icon="mic-off" /><div><H l={3}>We couldn&apos;t start your microphone</H><P style={{ fontSize: 15 }}>Another app may be using it. Close it and try again.</P></div></div>
              <Button onClick={() => void open()}>Try again</Button>
            </div>
          ) : state === "granted" ? (
            <div>
              <div style={{ marginBottom: 16 }}><Badge tone="success" dot>Microphone connected</Badge></div>
              <Muted style={{ marginBottom: 8 }}>Say something. The bars should move.</Muted>
              <MicMeter level={level} />
              <Muted style={{ marginTop: 10 }} aria-live="polite">Input level: {levelLabel(level)}</Muted>
            </div>
          ) : (
            <div className={styles.idle}>
              <div className={styles.tileRow}><Tile icon="mic" size={56} /></div>
              <H l={3}>Allow microphone access</H>
              <P style={{ margin: "6px 0 18px", fontSize: 15 }}>Your browser will ask for permission. We only record while you press Record.</P>
              <Button disabled={state === "requesting"} onClick={() => void open()}>{state === "requesting" ? "Waiting for permission…" : "Allow microphone"}</Button>
            </div>
          )}
        </Card>
        <Card>
          <H l={3} style={{ marginBottom: 12 }}>Before you enter</H>
          <ul className={styles.list}>{CHECKLIST.map(([ic, t]) => <li key={t}><Tile icon={ic} size={32} />{t}</li>)}</ul>
        </Card>
      </div>
      <Button fullWidth={compact} size="lg" disabled={state !== "granted"} className={styles.enter} onClick={() => router.push(`/session/${sessionId}/room`)}>Enter practice room</Button>
    </FlowShell>
  );
}
