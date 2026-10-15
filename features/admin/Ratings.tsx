"use client";
import { useState } from "react";
import { Card } from "@/components/ds/Card";
import { Tabs } from "@/components/ds/Tabs";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { AdminShell, Head } from "@/components/app/shells";
import { Stars } from "@/components/app/Stars";
import { Muted } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { formatDate } from "@/lib/format";
import { useAdminRatings } from "./queries";
import styles from "./Ratings.module.css";

const FILTERS = [{ value: "0", label: "All" }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} stars` }))];

/** A4 Ratings: average card, filter pills, rows, empty filter state. */
export function Ratings() {
  const compact = useCompact();
  const [f, setF] = useState("0");
  const all = useAdminRatings(null);
  const q = useAdminRatings(Number(f) || null);
  const ui = q.error ? errorUi(toAppError(q.error).code) : null;
  const rows = q.data?.rows ?? [];
  const avg = all.data?.average;
  return (
    <AdminShell active="/admin/ratings">
      <Head title="Report ratings" sub="What students think of their reports" right={
        <Card padding={14} className={styles.avg}><div className={styles.avgNo}>{avg === undefined || avg === null ? "–" : avg.toFixed(1)}</div><div><Stars n={Math.round(avg ?? 0)} /><Muted style={{ fontSize: 12 }}>average of {all.data?.count ?? 0} shown</Muted></div></Card>} />
      <div style={{ marginBottom: 16 }}><Tabs variant="pill" items={FILTERS} value={f} onChange={setF} label="Filter by stars" /></div>
      {ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => q.refetch()} /> : q.isPending ? <Card padding={24}><Skeleton h={40} /></Card> : (
        <Card padding={0}>
          <ul className={styles.list}>
            {rows.map((r, i) => (
              <li key={i} className={styles.row} style={{ gridTemplateColumns: compact ? "minmax(0,1fr)" : "minmax(0,1.2fr) minmax(0,1.2fr) 130px minmax(0,2fr) 110px", gap: compact ? 4 : 16, padding: compact ? "14px 16px" : "16px 24px" }}>
                <b className={styles.name}>{r.student_name}</b><span>{r.deck_title}</span><Stars n={r.stars} size={15} />
                <span>{r.comment || <i className={styles.nc}>No comment</i>}</span><span className={styles.date}>{formatDate(r.date)}</span>
              </li>
            ))}
          </ul>
          {rows.length === 0 && <div className={styles.none}>No ratings with that value.</div>}
        </Card>
      )}
    </AdminShell>
  );
}
