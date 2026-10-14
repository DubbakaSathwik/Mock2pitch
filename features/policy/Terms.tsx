"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Checkbox } from "@/components/ds/Checkbox";
import { Icon } from "@/components/ds/Icon";
import { Tabs } from "@/components/ds/Tabs";
import { Center } from "@/components/app/shells";
import { Doc } from "@/components/app/Doc";
import { Skeleton } from "@/components/app/Loading";
import { Tile } from "@/components/app/Tile";
import { H, Muted, P } from "@/components/app/Typography";
import { useCompact } from "@/components/app/Compact";
import { toAppError } from "@/lib/data/errors";
import { formatDate } from "@/lib/format";
import { safeNext } from "@/lib/safe-next";
import { useAcceptedVersions, useAcceptPolicy, useLatestPolicy } from "./queries";
import styles from "./Terms.module.css";

const TABS = [{ value: "terms", label: "Terms" }, { value: "privacy", label: "Privacy Policy" }] as const;

function PolicyBox({ tab, terms, privacy, compact }: { tab: string; terms: string; privacy: string; compact: boolean }) {
  return (
    <div className={styles.box} style={{ height: compact ? 280 : 320 }} tabIndex={0} role="region" aria-label={tab === "terms" ? "Terms text" : "Privacy Policy text"}>
      <Doc text={tab === "terms" ? terms : privacy} />
    </div>
  );
}

function PolicyLoading({ compact }: { compact: boolean }) {
  return <div style={{ height: compact ? 280 : 320 }} aria-busy="true"><Skeleton h="100%" r={12} /></div>;
}

/** S3 view-only (Landing footer, Settings): public, no checkbox. */
export function PolicyView({ initial }: { initial: "terms" | "privacy" }) {
  const compact = useCompact();
  const params = useSearchParams();
  const back = params.get("from") === "settings" ? "/settings" : "/";
  const [tab, setTab] = useState<string>(initial);
  const q = useLatestPolicy();
  return (
    <Center w={760}>
      <Card padding={compact ? 20 : 36}>
        <Link href={back} className={styles.back}><Icon name="chevron-left" size={16} />Back</Link>
        <H l={1} className={styles.title}>{tab === "terms" ? "Terms" : "Privacy Policy"}</H>
        <div className={styles.tabs}><Tabs variant="pill" items={TABS} value={tab} onChange={setTab} label="Document" /></div>
        {q.isPending ? <PolicyLoading compact={compact} /> : q.isError ? <PolicyError onRetry={() => q.refetch()} /> : <PolicyBox tab={tab} terms={q.data.terms_body} privacy={q.data.privacy_body} compact={compact} />}
        {q.data && <Muted style={{ marginTop: 10 }}>Version {q.data.version_label} · published {formatDate(q.data.published_at)}</Muted>}
      </Card>
    </Center>
  );
}

function PolicyError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className={styles.error}>
      <Icon name="triangle-alert" size={20} color="var(--danger-500)" />
      <div style={{ flex: 1 }}><b>We couldn&apos;t load this document.</b><Muted>Check your connection and try again.</Muted></div>
      <Button size="sm" variant="secondary" onClick={onRetry}>Try again</Button>
    </div>
  );
}

/** S3 first time ("Before you start") and updated (marine banner with version + date). Continue stays disabled until the box is ticked. */
export function AcceptTerms() {
  const compact = useCompact();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [tab, setTab] = useState<string>("terms");
  const [ok, setOk] = useState(false);
  const policy = useLatestPolicy();
  const accepted = useAcceptedVersions();
  const accept = useAcceptPolicy();
  const updated = (accepted.data?.length ?? 0) > 0;
  const loading = policy.isPending || accepted.isPending;
  const submit = () => { if (policy.data) accept.mutate(policy.data.id, { onSuccess: () => router.replace(next) }); };
  const err = accept.error ? toAppError(accept.error) : null;
  return (
    <Center w={760}>
      <Card padding={compact ? 20 : 36}>
        {!loading && updated && (
          <div className={styles.banner}><Tile icon="file-text" /><div><H l={3} as="h1" style={{ fontSize: 17 }}>We&apos;ve updated our terms</H><Muted>New version {policy.data?.version_label} · published {policy.data ? formatDate(policy.data.published_at) : ""}. Please review and accept to continue.</Muted></div></div>
        )}
        {!loading && !updated && <H l={1} className={styles.title}>Before you start</H>}
        <P style={{ marginBottom: 14 }}>Please read and accept our Terms and Privacy Policy.</P>
        <div className={styles.tabs}><Tabs variant="pill" items={TABS} value={tab} onChange={setTab} label="Document" /></div>
        {policy.isError ? <PolicyError onRetry={() => policy.refetch()} /> : loading || !policy.data ? <PolicyLoading compact={compact} /> : <PolicyBox tab={tab} terms={policy.data.terms_body} privacy={policy.data.privacy_body} compact={compact} />}
        <div className={styles.agree}><Checkbox checked={ok} onChange={setOk} label="I have read and agree to the Terms and the Privacy Policy" /></div>
        {err && <div role="alert" className={styles.error} style={{ marginBottom: 12 }}><Icon name="triangle-alert" size={20} color="var(--danger-500)" /><div><b>We couldn&apos;t save that.</b><Muted>{err.code === "not_latest_policy" ? "A newer version was just published. Reload to read it." : err.message}</Muted></div></div>}
        <Button fullWidth disabled={!ok || !policy.data || accept.isPending} onClick={submit}>{accept.isPending ? "Saving…" : "Continue"}</Button>
      </Card>
    </Center>
  );
}
