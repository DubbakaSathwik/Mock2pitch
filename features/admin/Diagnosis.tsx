"use client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Checkbox } from "@/components/ds/Checkbox";
import { Icon, type IconName } from "@/components/ds/Icon";
import { Input } from "@/components/ds/Input";
import { Select } from "@/components/ds/Select";
import { Textarea } from "@/components/ds/Textarea";
import { Notice } from "@/components/app/Notice";
import { AdminShell, Head } from "@/components/app/shells";
import { Tile } from "@/components/app/Tile";
import { H, Muted } from "@/components/app/Typography";
import { getData } from "@/lib/data";
import { toAppError } from "@/lib/data/errors";
import type { DiagnosisInput, DiagnosisResult, DiagnosisTarget } from "@/lib/data/types";
import type { Slot } from "@shared/constants.ts";
import styles from "./Diagnosis.module.css";

type Def = { target: DiagnosisTarget; title: string; icon: IconName; what: string; ai: boolean; custom: boolean; image: boolean };
const DEFS: Def[] = [
  { target: "gemini_slide", title: "Slide reading · Gemini", icon: "presentation", what: "Sends a sample slide with the real slide-reading prompt and checks the answer's shape.", ai: true, custom: true, image: true },
  { target: "nvidia_report", title: "Report writing · NVIDIA", icon: "chart-line", what: 'Asks the report model to reply with exactly {"ok":true}.', ai: true, custom: true, image: false },
  { target: "nvidia_asr", title: "Speech to text · NVIDIA", icon: "mic", what: "Sends a 6-second synthetic speech clip and compares the transcript with the known text.", ai: true, custom: false, image: false },
  { target: "storage", title: "File storage · Cloudflare R2", icon: "layers", what: "Writes, reads back and deletes one small file.", ai: false, custom: false, image: false },
  { target: "database", title: "Database · Supabase", icon: "gauge", what: "Runs a read query and checks the migrations are in place.", ai: false, custom: false, image: false },
];
const SLOTS: { value: Slot; label: string }[] = [{ value: "primary", label: "Primary key" }, { value: "fallback_1", label: "Fallback 1 key" }, { value: "fallback_2", label: "Fallback 2 key" }];
const HISTORY_KEY = "m2p.admin.diagnosis.history";
type HistoryRow = { target: DiagnosisTarget; mode: string; ran_at: string; verdict: string; ms: number; http_status: number | null; model: string | null; slot: string | null; reason: string | null };

const loadHistory = (): HistoryRow[] => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryRow[]; } catch { return []; } };
const saveHistory = (h: HistoryRow[]) => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20))); } catch { /* ignore */ } };
const VERDICT: Record<string, { tone: "success" | "danger" | "neutral"; label: string }> = { pass: { tone: "success", label: "Pass" }, fail: { tone: "danger", label: "Fail" }, unchecked: { tone: "neutral", label: "Answered, not checked" } };

function ResultView({ r }: { r: DiagnosisResult }) {
  const v = VERDICT[r.verdict]!;
  return (
    <div className={styles.result} data-testid={`result-${r.target}`}>
      <div className={styles.facts}>
        <Badge tone={v.tone}>{v.label}</Badge>
        <span>Time <b>{r.ms} ms</b></span>
        {r.http_status != null && <span>HTTP <b>{r.http_status}</b></span>}
        {r.model && <span>Model <b>{r.model}</b></span>}
        {r.key && <span>Key <b>{r.key.slot} {r.key.masked}</b></span>}
        <span>Mode <b>{r.mode}</b></span>
      </div>
      {r.error && (
        <Notice tone="danger" title={r.error.reason}>
          {r.error.hint}
          {r.error.upstream ? <div className={styles.upstream}>Message from the service: {r.error.upstream}</div> : null}
        </Notice>
      )}
      <div className={styles.box}><h4>Sent</h4><pre className={styles.pre}>{r.request || "(nothing was sent)"}</pre></div>
      <div className={styles.two}>
        <div className={styles.box}><h4>Expected</h4><pre className={styles.pre}>{r.expected || "—"}</pre></div>
        <div className={styles.box}><h4>Actual</h4><pre className={styles.pre}>{r.actual || "(no answer)"}</pre></div>
      </div>
      {r.checks.length > 0 && (
        <ul className={styles.checks} aria-label="Checks">
          {r.checks.map((c, i) => (
            <li key={i}><Icon name={c.ok ? "circle-check" : "circle-x"} size={16} color={c.ok ? "var(--success-500)" : "var(--danger-500)"} style={{ marginTop: 3 }} /><span>{c.name}{c.detail ? <Muted as="span"> ({c.detail})</Muted> : null}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TargetCard({ d, result, running, onRun }: { d: Def; result: DiagnosisResult | null; running: boolean; onRun: (i: DiagnosisInput) => void }) {
  const [slot, setSlot] = useState<Slot>("primary");
  const [model, setModel] = useState("");
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [expect, setExpect] = useState("");
  const [image, setImage] = useState(false);
  const base = d.ai ? { slot, ...(model.trim() ? { model: model.trim() } : {}) } : {};
  const v = result ? VERDICT[result.verdict]! : null;
  return (
    <Card role="region" aria-label={d.title}>
      <div className={styles.cardHead}>
        <div className={styles.cardTitle}><Tile icon={d.icon} size={44} /><div><H l={3}>{d.title}</H><Muted>{d.what}</Muted></div></div>
        {v ? <Badge tone={v.tone}>{v.label}</Badge> : <Badge tone="neutral">Not run</Badge>}
      </div>
      {d.ai && (
        <div className={styles.cfg}>
          <Select label="Key to test" options={SLOTS} value={slot} onChange={(e) => setSlot(e.target.value as Slot)} />
          <Input label="Model (optional)" placeholder="Leave empty to use the configured model" value={model} maxLength={100} onChange={(e) => setModel(e.target.value)} hint="Try a candidate model without changing the secrets." />
        </div>
      )}
      <div className={styles.actions}>
        <Button loading={running} onClick={() => onRun({ target: d.target, mode: "preset", ...base })}>Run preset test</Button>
        {d.custom && <Button variant="secondary" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? "Hide custom input" : "Send my own input"}</Button>}
      </div>
      {d.custom && open && (
        <div className={styles.custom}>
          <Textarea label="Your prompt" rows={3} maxLength={4000} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <Input label="Answer should contain (optional)" value={expect} maxLength={500} onChange={(e) => setExpect(e.target.value)} hint="If set, the test passes only when the answer contains this text." />
          {d.image && <Checkbox checked={image} onChange={setImage} label="Attach the sample slide image" />}
          <div className={styles.actions}><Button loading={running} onClick={() => onRun({ target: d.target, mode: "custom", prompt, ...(expect.trim() ? { expect: expect.trim() } : {}), ...(d.image ? { include_image: image } : {}), ...base })}>Send</Button></div>
        </div>
      )}
      {result && <ResultView r={result} />}
    </Card>
  );
}

/** A-Diagnosis: test every API (and storage / database) with a preset or your own input; see sent vs expected vs actual, timing and the reason for a failure. */
export function Diagnosis() {
  const [results, setResults] = useState<Partial<Record<DiagnosisTarget, DiagnosisResult>>>({});
  const [running, setRunning] = useState<Partial<Record<DiagnosisTarget, boolean>>>({});
  const [all, setAll] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  useEffect(() => { setHistory(loadHistory()); }, []);

  const record = (r: DiagnosisResult, slot: string | null) => {
    setResults((x) => ({ ...x, [r.target]: r }));
    setHistory((h) => { const n = [{ target: r.target, mode: r.mode, ran_at: r.ran_at, verdict: r.verdict, ms: r.ms, http_status: r.http_status, model: r.model, slot, reason: r.error?.reason ?? null }, ...h].slice(0, 20); saveHistory(n); return n; });
  };
  const run = async (input: DiagnosisInput) => {
    setRunning((x) => ({ ...x, [input.target]: true }));
    try { record(await getData().admin.diagnose(input), input.slot ?? null); }
    catch (e) {
      const err = toAppError(e);
      record({ target: input.target, mode: input.mode ?? "preset", ran_at: new Date().toISOString(), ok: false, verdict: "fail", ms: 0, http_status: null, model: input.model ?? null, key: null, request: input.prompt ?? "", expected: "", actual: "",
        checks: [], error: err.code === "not_found"
          ? { kind: "not_found", reason: "The diagnosis function is not deployed on your Supabase project yet (HTTP 404), so nothing was tested.", hint: "Run the \"Deploy Supabase Edge Functions\" workflow on the latest code (it deploys admin-diagnose), then try again. This is not a Gemini / NVIDIA / storage / database failure.", upstream: err.message }
          : { kind: "network", reason: err.code === "forbidden" ? "Only the owner can run diagnosis." : "The diagnosis request itself failed.", hint: "Check your connection and that the admin-diagnose function is deployed, then try again.", upstream: err.message } }, input.slot ?? null);
    } finally { setRunning((x) => ({ ...x, [input.target]: false })); }
  };
  const runAll = async () => { setAll(true); for (const d of DEFS) await run({ target: d.target, mode: "preset" }); setAll(false); };
  const clear = () => { setHistory([]); saveHistory([]); };
  const passed = DEFS.filter((d) => results[d.target]?.verdict === "pass").length;
  const ran = DEFS.filter((d) => results[d.target]).length;

  return (
    <AdminShell active="/admin/diagnosis">
      <Head title="Diagnosis" sub="Test each service with a preset or your own input. These are real calls: they use provider credits and are not counted on the AI usage page." />
      <div className={styles.toolbar}>
        <Button size="lg" iconLeft="activity" loading={all} onClick={() => void runAll()}>Run all presets</Button>
        {ran > 0 && <Badge tone={passed === ran ? "success" : "warning"}>{passed} of {ran} passed</Badge>}
      </div>
      <div className={styles.grid}>
        {DEFS.map((d) => <TargetCard key={d.target} d={d} result={results[d.target] ?? null} running={!!running[d.target]} onRun={(i) => void run(i)} />)}
      </div>
      <Card style={{ marginTop: 16 }} role="region" aria-label="Recent runs">
        <div className={styles.cardHead}><H l={3}>Recent runs</H>{history.length > 0 && <Button size="sm" variant="secondary" onClick={clear}>Clear</Button>}</div>
        {history.length === 0 ? <Muted style={{ marginTop: 8 }}>Nothing yet. Runs are kept in this browser only.</Muted> : (
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className={styles.hist}>
              <thead><tr><th>Time</th><th>Service</th><th>Result</th><th>Details</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td>{new Date(h.ran_at).toLocaleTimeString()}</td>
                    <td>{DEFS.find((d) => d.target === h.target)?.title ?? h.target}{h.mode === "custom" ? " (custom)" : ""}</td>
                    <td><Badge tone={VERDICT[h.verdict]?.tone ?? "neutral"}>{VERDICT[h.verdict]?.label ?? h.verdict}</Badge></td>
                    <td>{h.reason ?? [h.http_status != null ? `HTTP ${h.http_status}` : null, `${h.ms} ms`, h.model, h.slot].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminShell>
  );
}
