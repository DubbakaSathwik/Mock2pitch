"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Dialog } from "@/components/ds/Dialog";
import { Input } from "@/components/ds/Input";
import { Tabs } from "@/components/ds/Tabs";
import { useToast } from "@/components/ds/Toast";
import { useCompact } from "@/components/app/Compact";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice, Notice } from "@/components/app/Notice";
import { AdminShell, Head } from "@/components/app/shells";
import { H, Muted, P } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { toAppError } from "@/lib/data/errors";
import { formatDate } from "@/lib/format";
import { nextLabel, validateLabel } from "./policy";
import { usePolicyVersions, usePublishPolicy } from "./queries";
import styles from "./TermsEditor.module.css";

const TABS = [{ value: "terms", label: "Terms" }, { value: "privacy", label: "Privacy Policy" }];

/** Warns before the owner loses unsaved edits: tab close/reload, and in-app link clicks (a confirm dialog). */
function useUnsavedGuard(dirty: boolean, onBlocked: (href: string) => void) {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const click = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault(); e.stopPropagation();
      onBlocked(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); };
  }, [dirty, onBlocked]);
}

/** A6 Terms & Privacy: tabbed editor prefilled with the live text, version history, publish dialog. */
export function TermsEditor() {
  const compact = useCompact();
  const router = useRouter();
  const { toast } = useToast();
  const versions = usePolicyVersions();
  const publish = usePublishPolicy();
  const live = versions.data?.find((v) => v.is_live);
  const [tab, setTab] = useState("terms");
  const [draft, setDraft] = useState<{ terms: string; privacy: string } | null>(null);
  const [base, setBase] = useState<{ terms: string; privacy: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [labelErr, setLabelErr] = useState("");
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const seeded = useRef(false);
  useEffect(() => {
    if (live && !seeded.current) { seeded.current = true; const b = { terms: live.terms_body, privacy: live.privacy_body }; setBase(b); setDraft(b); }
  }, [live]);
  const dirty = !!draft && !!base && (draft.terms !== base.terms || draft.privacy !== base.privacy);
  useUnsavedGuard(dirty, setLeaveTo);

  const openDialog = () => { setLabel(live ? nextLabel(live.version_label) : "v1.0"); setNote(""); setLabelErr(""); publish.reset(); setOpen(true); };
  const doPublish = () => {
    if (!live || !draft) return;
    const e = validateLabel(label, live.version_label);
    if (e) { setLabelErr(e); return; }
    publish.mutate({ version_label: label.trim(), terms_body: draft.terms, privacy_body: draft.privacy, note: note.trim() || undefined }, {
      onSuccess: () => { setOpen(false); setBase(draft); toast("New version published. Students must re-accept."); },
    });
  };
  const err = publish.error ? toAppError(publish.error) : null;
  const errUi = err ? errorUi(err.code, err.details) : null;
  const ui = versions.error ? errorUi(toAppError(versions.error).code) : null;
  const text = draft ? (tab === "terms" ? draft.terms : draft.privacy) : "";

  return (
    <AdminShell active="/admin/terms">
      <Head title="Terms and Privacy Policy" sub="Edit the text, then publish a new version." right={<Button iconLeft="upload" disabled={!draft || !dirty} onClick={openDialog}>Publish new version</Button>} />
      {ui?.kind === "inline" ? <ErrorNotice title={ui.title} body={ui.body} onRetry={() => versions.refetch()} /> : (
        <div className={styles.grid} style={{ gridTemplateColumns: compact ? "1fr" : "1.6fr 1fr" }}>
          <Card>
            <div style={{ marginBottom: 14 }}><Tabs variant="pill" items={TABS} value={tab} onChange={setTab} label="Document" /></div>
            {!draft ? <Skeleton h={compact ? 320 : 460} r={12} /> : (
              <textarea aria-label={tab === "terms" ? "Terms text" : "Privacy Policy text"} className={styles.area} style={{ height: compact ? 320 : 460 }} value={text} onChange={(e) => setDraft({ ...draft, [tab]: e.target.value })} />
            )}
            <Muted style={{ marginTop: 8 }}>Use &quot;## Heading&quot; on its own line to start a section.{dirty && " You have unpublished changes."}</Muted>
          </Card>
          <Card padding={0} style={{ alignSelf: "start" }} aria-label="Version history">
            <div style={{ padding: "18px 24px" }}><H l={3}>Version history</H></div>
            {versions.isPending ? <div style={{ padding: "0 24px 24px" }}><Skeleton h={48} /></div> : (versions.data ?? []).map((v) => (
              <div key={v.id} className={styles.ver}>
                <div><b className={styles.vl}>{v.version_label}</b> {v.is_live && <Badge tone="success">Live</Badge>}<Muted style={{ fontSize: 13 }}>{v.note ?? ""}</Muted></div>
                <Muted style={{ fontSize: 13 }}>{formatDate(v.published_at)}</Muted>
              </div>
            ))}
          </Card>
        </div>
      )}
      <Dialog open={open} title="Publish a new version?" onClose={() => setOpen(false)} width={480}
        actions={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={publish.isPending} onClick={doPublish}>{publish.isPending ? "Publishing…" : "Publish"}</Button></>}>
        <P>Every student will need to accept the new Terms and Privacy Policy before they can continue. It never interrupts a practice session in progress.</P>
        <div className={styles.fields}>
          <Input label="Version label" value={label} error={labelErr} onChange={(e) => { setLabel(e.target.value); setLabelErr(""); }} hint={live ? `Current version: ${live.version_label}` : undefined} />
          <Input label="Note (optional)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="What changed?" />
        </div>
        {errUi?.kind === "inline" && <div style={{ marginTop: 12 }}><Notice tone="danger" title={errUi.title}>{errUi.body}</Notice></div>}
      </Dialog>
      <Dialog open={leaveTo !== null} title="Discard unpublished changes?" onClose={() => setLeaveTo(null)} width={440}
        actions={<><Button variant="secondary" onClick={() => setLeaveTo(null)}>Keep editing</Button><Button variant="record" onClick={() => { const to = leaveTo!; setBase(draft); setLeaveTo(null); setTimeout(() => router.push(to), 0); }}>Discard</Button></>}>
        <P>Your edits to the Terms or Privacy Policy haven&apos;t been published and will be lost.</P>
      </Dialog>
    </AdminShell>
  );
}
