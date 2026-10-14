"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { useCompact } from "@/components/app/Compact";
import { ErrorNotice } from "@/components/app/Notice";
import { FlowShell, Head } from "@/components/app/shells";
import { Tile } from "@/components/app/Tile";
import { H, Muted } from "@/components/app/Typography";
import { MAX_PDF_BYTES, MAX_SLIDES } from "@shared/constants.ts";
import { useUploadFlow, type UploadPhase } from "./useUploadFlow";
import styles from "./Upload.module.css";

const MB = MAX_PDF_BYTES / (1024 * 1024);

function describe(p: UploadPhase): { title: string; pct: number; text: string } {
  switch (p.kind) {
    case "validating": return { title: "Checking your PDF", pct: 5, text: "Checking your PDF…" };
    case "uploading": return { title: "Uploading your PDF", pct: 5 + p.pct * 0.3, text: `Uploading your PDF… ${p.pct}%` };
    case "rendering": return { title: "Preparing your slides", pct: 35 + (p.page / p.total) * 35, text: `Preparing slide ${p.page} of ${p.total}` };
    case "sending-images": return { title: "Uploading slide images", pct: 70 + (p.total ? (p.done / p.total) * 25 : 0), text: `Uploading slide ${Math.min(p.done + 1, p.total)} of ${p.total}` };
    case "starting": return { title: "Starting the AI reader", pct: 97, text: "Starting…" };
    default: return { title: "", pct: 0, text: "" };
  }
}

/** S6 Upload: PDF only (≤ 10 slides, ≤ 5 MB). Errors render below the dropzone. */
export function Upload() {
  const compact = useCompact();
  const flow = useUploadFlow();
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pick = (f: File | undefined | null) => { if (f) void flow.start(f); };
  const d = describe(flow.phase);
  return (
    <FlowShell step="upload">
      <Head title="Upload your slides" sub={`PDF only, up to ${MAX_SLIDES} slides and ${MB} MB. We read each slide to suggest key points. Your slide design is never rated.`} />
      {flow.busy ? (
        <Card padding={compact ? 28 : 48} className={styles.progress} aria-live="polite" aria-busy="true" data-testid="upload-progress">
          <div className={styles.tileRow}><Tile icon="upload" size={56} /></div>
          <H l={2} style={{ fontSize: 20 }}>{d.title}</H>
          <Muted style={{ margin: "6px 0 18px" }} id="upload-status">{d.text}</Muted>
          <div style={{ maxWidth: 420, margin: "0 auto" }}><ProgressBar value={d.pct} max={100} ariaLabel="Upload progress" /></div>
        </Card>
      ) : (
        <div className={`${styles.drop} ${drag ? styles.dragging : ""}`} data-testid="dropzone"
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }} onClick={() => input.current?.click()}>
          <div className={styles.tileRow}><Tile icon="upload" size={56} /></div>
          <H l={2} style={{ fontSize: 20 }}>{compact ? "Tap to choose your PDF" : "Drag your PDF here"}</H>
          <Muted style={{ margin: "6px 0 18px" }}>PDF · up to {MAX_SLIDES} slides · {MB} MB</Muted>
          <Button variant="secondary" onClick={(e) => { e.stopPropagation(); input.current?.click(); }}>Choose a file</Button>
          <input ref={input} type="file" accept=".pdf,application/pdf" hidden aria-label="Choose a PDF file" data-testid="file-input" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
      )}
      {flow.failure && (
        <div className={styles.err} data-testid="upload-error">
          <ErrorNotice title={flow.failure.ui.title} body={flow.failure.ui.body} onRetry={flow.failure.ui.retry ? flow.retry : undefined} />
        </div>
      )}
      <Card variant="sunken" padding={16} className={styles.hint}>
        <Icon name="info" size={18} color="var(--bright-marine)" />
        <Muted as="span">Using PowerPoint? Choose File → Save as PDF, then upload it here.</Muted>
      </Card>
    </FlowShell>
  );
}
