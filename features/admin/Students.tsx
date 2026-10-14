"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Input } from "@/components/ds/Input";
import { useToast } from "@/components/ds/Toast";
import { Avatar } from "@/components/app/Avatar";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { AdminShell, Head } from "@/components/app/shells";
import { Muted } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { relativeDay } from "@/lib/format";
import { useDebounced } from "@/lib/useDebounced";
import type { AdminStudent } from "@/lib/data/types";
import { useAdminStudents, useSetBlocked } from "./queries";
import styles from "./Students.module.css";

const PAGE = 25;

/** A2 Students: debounced search, table (desktop) / cards (mobile), block/unblock without a confirm step (toast + optimistic row). */
export function Students() {
  const compact = useCompact();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const search = useDebounced(q.trim(), 300);
  const list = useAdminStudents(search, limit);
  const block = useSetBlocked();
  const rows = list.data ?? [];
  const total = rows[0]?.total_count ?? 0;
  const toggle = (s: AdminStudent) => block.mutate({ userId: s.user_id, blocked: !s.is_blocked }, {
    onSuccess: () => toast(s.is_blocked ? "Student unblocked" : "Student blocked"),
    onError: () => toast("We couldn't update that student. Try again.", "danger"),
  });
  const ui = list.error ? errorUi(toAppError(list.error).code) : null;
  const name = (s: AdminStudent) => s.full_name ?? s.email;
  const actions = (s: AdminStudent) => (
    <span className={styles.actions}>
      <Link href={`/admin/students/${s.user_id}`}><Button size="sm" variant="secondary" aria-label={`View ${name(s)}`}>View</Button></Link>
      <Button size="sm" variant="ghost" aria-label={`${s.is_blocked ? "Unblock" : "Block"} ${name(s)}`} onClick={() => toggle(s)}>{s.is_blocked ? "Unblock" : "Block"}</Button>
    </span>
  );
  return (
    <AdminShell active="/admin/students">
      <Head title="Students" sub={list.isPending ? " " : `${rows.length} of ${total || rows.length} shown`} right={<div style={{ width: compact ? "100%" : 300 }}><Input icon="search" type="search" aria-label="Search students" placeholder="Search name, email or college" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} /></div>} />
      {ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => list.refetch()} /> : list.isPending ? <Card padding={24}><Skeleton h={40} /></Card> : compact ? (
        <ul className={styles.cards}>
          {rows.map((s) => (
            <li key={s.user_id}>
              <Card padding={16}>
                <div className={styles.cardTop}>
                  <Avatar name={name(s)} src={s.avatar_url} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}><div className={styles.name}>{name(s)} {s.is_blocked && <Badge tone="danger">Blocked</Badge>}</div><Muted style={{ fontSize: 12 }}>{[s.college, s.year, s.branch].filter(Boolean).join(" · ")}</Muted></div>
                  <div className={styles.avg}>{s.average_score ?? "–"}</div>
                </div>
                <div style={{ marginTop: 12 }}>{actions(s)}</div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card padding={0}>
          <table className={styles.table}>
            <thead><tr>{["Name", "Email", "College", "Year", "Branch", "Sessions", "Last active", "Avg"].map((h) => <th key={h} scope="col">{h}</th>)}<th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.user_id} className={s.is_blocked ? styles.blocked : undefined}>
                  <td className={styles.name}>{name(s)}{s.is_blocked && <> <Badge tone="danger">Blocked</Badge></>}</td>
                  <td className={styles.ell}>{s.email}</td><td>{s.college}</td><td>{s.year}</td><td>{s.branch}</td><td>{s.attempts}</td><td>{relativeDay(s.last_active_at)}</td><td><b>{s.average_score ?? "–"}</b></td>
                  <td>{actions(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {!list.isPending && rows.length === 0 && !ui && <Card padding={32} className={styles.none}><Muted>No students match &ldquo;{search}&rdquo;</Muted></Card>}
      {rows.length > 0 && rows.length < total && <div className={styles.more}><Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>Load more</Button></div>}
    </AdminShell>
  );
}
