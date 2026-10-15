"use client";
// M2P_MOCK_PANEL_SENTINEL — dev-only control panel for the mock backend. Never part of a production bundle (see app/providers.tsx).
import { useEffect, useState, useSyncExternalStore } from "react";
import { getMockControl } from "@/lib/data";
import { PERSONAS, PERSONA_LABEL, type PersonaId } from "@/lib/data/mock";
import styles from "./MockPanel.module.css";

export function MockPanel() {
  const [open, setOpen] = useState(false);
  const [ctl, setCtl] = useState<ReturnType<typeof getMockControl>>(null);
  useEffect(() => { setCtl(getMockControl()); }, []);
  const snap = useSyncExternalStore(
    (cb) => (ctl ? ctl.subscribe(cb) : () => {}),
    () => (ctl ? JSON.stringify([ctl.getPersona(), ctl.getConfig()]) : ""),
    () => "",
  );
  const [failKind, setFailKind] = useState<"deck-process" | "session-analyse">("deck-process");
  const [failCode, setFailCode] = useState("ai_unavailable");
  if (!ctl) return null;
  const [persona, cfg] = snap ? (JSON.parse(snap) as [PersonaId, { latencyMs: number; stageMs: number; realtime: boolean }]) : [ctl.getPersona(), ctl.getConfig()];
  return (
    <div className={styles.wrap} data-testid="mock-panel">
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Mock backend controls">
          <p className={styles.h}>Persona</p>
          <div className={styles.grid}>
            {PERSONAS.map((p) => <button key={p} type="button" className={`${styles.chip} ${p === persona ? styles.on : ""}`} onClick={() => { ctl.setPersona(p); window.location.assign(p === "admin" ? "/admin" : p === "signed_out" ? "/" : "/dashboard"); }}>{PERSONA_LABEL[p]}</button>)}
          </div>
          <p className={styles.h}>Events</p>
          <div className={styles.row}>
            <button type="button" className={styles.btn} onClick={() => ctl.republishPolicy()}>Republish Terms</button>
            <button type="button" className={styles.btn} onClick={() => ctl.breakAssetUrlsOnce()}>Expire slide URLs once</button>
            <button type="button" className={styles.btn} onClick={() => ctl.failNextPuts(1)}>Fail next upload</button>
          </div>
          <p className={styles.h}>Fail the next AI call</p>
          <div className={styles.row}>
            <select aria-label="Which call" value={failKind} onChange={(e) => setFailKind(e.target.value as typeof failKind)}><option value="deck-process">Reading slides</option><option value="session-analyse">Analysing session</option></select>
            <select aria-label="Error code" value={failCode} onChange={(e) => setFailCode(e.target.value)}>{["ai_unavailable", "report_invalid", "processing_failed", "analysis_failed", "audio_invalid"].map((c) => <option key={c}>{c}</option>)}</select>
            <button type="button" className={styles.btn} onClick={() => ctl.failNext({ kind: failKind, code: failCode as never })}>Arm</button>
          </div>
          <p className={styles.h}>Speed (ms)</p>
          <div className={styles.row}>
            <label>latency <input type="number" min={0} value={cfg.latencyMs} onChange={(e) => ctl.setConfig({ latencyMs: Math.max(0, Number(e.target.value)) })} /></label>
            <label>stage <input type="number" min={0} value={cfg.stageMs} onChange={(e) => ctl.setConfig({ stageMs: Math.max(0, Number(e.target.value)) })} /></label>
            <label><input type="checkbox" checked={cfg.realtime} onChange={(e) => ctl.setConfig({ realtime: e.target.checked })} /> realtime</label>
          </div>
          <div className={styles.row}><button type="button" className={styles.btn} onClick={() => { ctl.reset(); window.location.reload(); }}>Reset mock data</button></div>
        </div>
      )}
      <button type="button" className={styles.fab} aria-expanded={open} onClick={() => setOpen(!open)}>Mock</button>
    </div>
  );
}
