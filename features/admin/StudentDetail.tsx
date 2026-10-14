"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { useToast } from "@/components/ds/Toast";
import { Avatar } from "@/components/app/Avatar";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { AdminShell } from "@/components/app/shells";
import { Stars } from "@/components/app/Stars";
import { H, Muted, P } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { formatDayMonth } from "@/lib/format";
import { scoreColor } from "@/lib/score";
import { useSetBlocked, useStudentDetail } from "./queries";
import styles from "./StudentDetail.module.css";

/** A3 Student detail: profile + block, practice attempts (deck titles and scores only), ratings given. */
export function StudentDetail() {
  const { userId } = useParams<{ userId: string }>();
  const compact = useCompact();
  const { toast } = useToast();
  const q = useStudentDetail(userId);
  const block = useSetBlocked();
  const ui = q.error ? errorUi(toAppError(q.error).code) : null;
  const d = q.data;
  const toggle = () => d && block.mutate({ userId, blocked: !d.profile.is_blocked }, {
    onSuccess: () => toast(d.profile.is_blocked ? "Student unblocked" : "Student blocked"),
    onError: () => toast("We couldn't update that student. Try again.", "danger"),
  });
  return (
    <AdminShell active="/admin/students">
      <Link href="/admin/students" className={styles.back}><Icon name="chevron-left" size={16} />Students</Link>
      {q.isPending ? <Skeleton h={120} r={16} /> : ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => q.refetch()} /> : d && (
        <>
          <Card>
            <div className={styles.profile} style={{ flexDirection: compact ? "column" : "row", alignItems: compact ? "flex-start" : "center" }}>
              <Avatar name={d.profile.full_name ?? d.profile.email} src={d.profile.avatar_url} size={64} />
              <div style={{ flex: 1 }}>
                <H l={1} className={styles.name}>{d.profile.full_name ?? d.profile.email} {d.profile.is_blocked && <Badge tone="danger">Blocked</Badge>}</H>
                <Muted>{d.profile.email}</Muted>
                <Muted>{[d.profile.college, d.profile.year, d.profile.branch].filter(Boolean).join(" · ")}</Muted>
              </div>
              <Button variant={d.profile.is_blocked ? "primary" : "secondary"} iconLeft={d.profile.is_blocked ? "check" : "ban"} disabled={block.isPending} onClick={toggle}>{d.profile.is_blocked ? "Unblock" : "Block student"}</Button>
            </div>
          </Card>
          <div className={styles.grid} style={{ gridTemplateColumns: compact ? "1fr" : "1.2fr 1fr" }}>
            <Card padding={0} aria-label="Practice attempts">
              <div style={{ padding: "18px 24px" }}><H l={3}>Practice attempts</H></div>
              {d.attempts.length === 0 ? <div className={styles.empty}>No attempts yet.</div> : d.attempts.map((a) => (
                <div key={a.report_id} className={styles.attempt}>
                  <div className={styles.score} style={{ color: scoreColor(a.overall_score) }}>{a.overall_score}</div>
                  <div style={{ flex: 1 }}><b className={styles.title}>{a.deck_title}</b><Muted>Attempt {a.attempt_number}</Muted></div>
                  <Muted>{formatDayMonth(a.date)}</Muted>
                </div>
              ))}
            </Card>
            <Card padding={0} aria-label="Ratings given">
              <div style={{ padding: "18px 24px" }}><H l={3}>Ratings given</H></div>
              {d.ratings.length === 0 ? <div className={styles.empty}>No ratings given.</div> : d.ratings.map((r, k) => (
                <div key={k} className={styles.rating}><Stars n={r.stars} size={14} /><P style={{ fontSize: 14 }}>{r.comment || "No comment"}</P><Muted style={{ fontSize: 12 }}>{r.deck_title} · {formatDayMonth(r.date)}</Muted></div>
              ))}
            </Card>
          </div>
        </>
      )}
    </AdminShell>
  );
}
