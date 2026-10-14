"use client";
import { Badge } from "@/components/ds/Badge";
import { Card } from "@/components/ds/Card";
import type { IconName } from "@/components/ds/Icon";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { BarChart } from "@/components/app/BarChart";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { AdminShell, Head } from "@/components/app/shells";
import { Tile } from "@/components/app/Tile";
import { H, Muted } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { formatDayMonth } from "@/lib/format";
import type { AiSlotUsage } from "@/lib/data/types";
import type { Purpose, Slot } from "@shared/constants.ts";
import { useAiKeys, useAiUsage } from "./queries";
import styles from "./AiUsage.module.css";

export const PURPOSE_UI: Record<Purpose, { title: string; icon: IconName }> = {
  slide_reading: { title: "Slide reading", icon: "presentation" },
  speech_to_text: { title: "Speech to text", icon: "mic" },
  report_generation: { title: "Report analysis", icon: "chart-line" },
};
export const SLOT_LABEL: Record<Slot, string> = { primary: "Primary", fallback_1: "Fallback 1", fallback_2: "Fallback 2" };

/** Status badges for one key slot: Not configured · Cooling down · Running low (> 75 %) · Configured. */
export function slotBadges(configured: boolean, u: Pick<AiSlotUsage, "running_low" | "cooldown_until">, now = Date.now()): { tone: "neutral" | "warning" | "success"; label: string }[] {
  if (!configured) return [{ tone: "neutral", label: "Not configured" }];
  const out: { tone: "neutral" | "warning" | "success"; label: string }[] = [];
  if (u.cooldown_until && new Date(u.cooldown_until).getTime() > now) out.push({ tone: "warning", label: "Cooling down" });
  if (u.running_low) out.push({ tone: "warning", label: "Running low" });
  if (out.length === 0) out.push({ tone: "success", label: "Configured" });
  return out;
}

/** A5 AI usage: 3 purposes × 3 key slots, each card with its own "Credits used per day" chart. */
export function AiUsage() {
  const compact = useCompact();
  const usage = useAiUsage(7);
  const keys = useAiKeys();
  const err = usage.error ?? keys.error;
  const ui = err ? errorUi(toAppError(err).code) : null;
  return (
    <AdminShell active="/admin/ai-usage">
      <Head title="AI usage and credits" sub="Keys are shown masked. Usage over the last 7 days." />
      {ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => { void usage.refetch(); void keys.refetch(); }} /> : (
        <div className={styles.grid} style={{ gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit,minmax(340px,1fr))" }}>
          {usage.isPending || keys.isPending ? [0, 1, 2].map((k) => <Skeleton key={k} h={420} r={16} />) : (usage.data?.purposes ?? []).map((p) => {
            const meta = PURPOSE_UI[p.purpose];
            const model = keys.data?.purposes.find((x) => x.purpose === p.purpose);
            return (
              <Card key={p.purpose} as="section" aria-label={meta.title}>
                <div className={styles.head}><Tile icon={meta.icon} /><div><H l={3} as="h2">{meta.title}</H><div className={styles.model}>{model?.model}</div></div></div>
                <ul className={styles.slots}>
                  {p.slots.map((s) => {
                    const k = model?.slots.find((x) => x.slot_id === s.slot_id);
                    const configured = k?.configured ?? false;
                    const badges = slotBadges(configured, s);
                    const pct = s.percent_used;
                    return (
                      <li key={s.slot_id} className={styles.slot} data-testid={`slot-${p.purpose}-${s.slot}`}>
                        <div className={styles.slotTop}>
                          <span className={styles.slotName}>{SLOT_LABEL[s.slot]}</span>
                          <code className={styles.key}>{configured ? k?.masked : "—"}</code>
                          <span className={styles.badges}>{badges.map((b) => <Badge key={b.label} tone={b.tone}>{b.label}</Badge>)}</span>
                        </div>
                        {configured && (
                          <>
                            <ProgressBar value={s.used} max={Math.max(1, s.credit_limit)} tone={pct > 75 ? "warning" : "marine"} ariaLabel={`${meta.title} ${SLOT_LABEL[s.slot]} credits used`} />
                            <div className={styles.nums}><span>Used <b>{s.used.toLocaleString("en-IN")}</b></span><span>Remaining <b>{s.remaining.toLocaleString("en-IN")}</b></span></div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Muted style={{ fontSize: 13, margin: "4px 0 8px" }}>Credits used per day</Muted>
                <BarChart data={p.per_day.map((d) => d.count)} labels={p.per_day.map((d) => formatDayMonth(d.date))} h={110} values caption={`${meta.title}: credits used per day`} />
              </Card>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
