"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BRANCHES, COLLEGE_YEARS, DAILY_SESSION_LIMIT, MAX_SLIDES, MAX_TOTAL_MINUTES } from "@shared/constants.ts";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Dialog } from "@/components/ds/Dialog";
import { Icon } from "@/components/ds/Icon";
import { Input } from "@/components/ds/Input";
import { Select } from "@/components/ds/Select";
import { useToast } from "@/components/ds/Toast";
import { Avatar } from "@/components/app/Avatar";
import { useCompact } from "@/components/app/Compact";
import { Notice } from "@/components/app/Notice";
import { Head, StudentShell } from "@/components/app/shells";
import { H, Muted, P } from "@/components/app/Typography";
import { useSignOut } from "@/features/auth/queries";
import { useDashboardStats } from "@/features/dashboard/queries";
import { useDeleteAccount } from "@/features/account/queries";
import { useMyProfile, useUpdateProfile } from "@/features/profile/queries";
import { profileSchema } from "@/features/profile/schema";
import { toAppError } from "@/lib/data/errors";
import { setFlash } from "@/lib/flash";
import styles from "./Settings.module.css";

/** S17 Settings: profile, limits, Terms/Privacy (view-only), sign out and the Danger zone (delete account). */
export function Settings() {
  const compact = useCompact();
  const router = useRouter();
  const { toast } = useToast();
  const profile = useMyProfile();
  const stats = useDashboardStats();
  const update = useUpdateProfile();
  const signOut = useSignOut();
  const del = useDeleteAccount();
  const [f, setF] = useState({ college: "", year: "", branch: "" });
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  useEffect(() => { if (profile.data) setF({ college: profile.data.college ?? "", year: profile.data.year ?? COLLEGE_YEARS[0], branch: profile.data.branch ?? BRANCHES[0] }); }, [profile.data]);
  const blocked = !!profile.data?.is_blocked;
  const p = profile.data;
  const used = stats.data?.sessions_used_today ?? 0;

  const save = () => {
    const r = profileSchema.safeParse(f);
    if (!r.success) { setErr(r.error.issues[0]?.message ?? "Check your details"); return; }
    update.mutate(r.data, { onSuccess: () => toast("Profile saved"), onError: (e) => toast(toAppError(e).code === "blocked" ? "Your account is paused." : "We couldn't save that. Try again.", "danger") });
  };
  const closeDelete = () => { setConfirm(false); setTyped(""); del.reset(); };
  const doDelete = () => del.mutate(undefined, { onSuccess: () => { setFlash("Your account was deleted"); router.replace("/"); } });
  const delErr = del.error ? toAppError(del.error) : null;

  return (
    <StudentShell active="settings" maxW={860}>
      <Head title="Profile and settings" />
      {blocked && <div style={{ marginBottom: 16 }}><Notice tone="info" title="Your account is paused">You can still read your reports. Editing your profile and deleting your account are unavailable until the owner restores access.</Notice></div>}
      <Card>
        <div className={styles.who}><Avatar name={p?.full_name ?? p?.email ?? "You"} src={p?.avatar_url} size={56} /><div><div className={styles.name}>{p?.full_name ?? p?.email}</div><Muted>{p?.email}</Muted></div></div>
        <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Input label="College" value={f.college} error={err} disabled={blocked} onChange={(e) => { setF({ ...f, college: e.target.value }); setErr(""); }} />
          <div className={styles.two}>
            <Select label="Year" options={COLLEGE_YEARS} value={f.year} disabled={blocked} onChange={(e) => setF({ ...f, year: e.target.value })} />
            <Select label="Branch" options={BRANCHES} value={f.branch} disabled={blocked} onChange={(e) => setF({ ...f, branch: e.target.value })} />
          </div>
          <div><Button type="submit" disabled={blocked || update.isPending}>{update.isPending ? "Saving…" : "Save changes"}</Button></div>
        </form>
      </Card>
      <Card style={{ marginTop: 20 }}>
        <H l={3} style={{ marginBottom: 14 }}>Usage limits</H>
        <div className={styles.limits}>
          {([["Practice sessions per day", `${used} of ${DAILY_SESSION_LIMIT} used today`], ["Slides per deck", `Up to ${MAX_SLIDES}`], ["Total duration", `Up to ${MAX_TOTAL_MINUTES} minutes`]] as const).map(([a, b]) => (
            <div key={a} className={styles.limit}><Muted>{a}</Muted><div className={styles.limitVal}>{b}</div></div>
          ))}
        </div>
      </Card>
      <Card style={{ marginTop: 20 }}>
        {([["Terms", "/terms?from=settings"], ["Privacy Policy", "/privacy?from=settings"]] as const).map(([l, href]) => (
          <Link key={l} href={href} className={styles.link}>{l}<Icon name="chevron-right" size={18} /></Link>
        ))}
      </Card>
      <Button variant="secondary" iconLeft="log-out" style={{ marginTop: 20 }} disabled={signOut.isPending} onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace("/") })}>Sign out</Button>
      <Card variant="default" className={styles.danger} aria-label="Danger zone">
        <H l={3} style={{ color: "var(--danger-text)", marginBottom: 6 }}>Danger zone</H>
        <P style={{ fontSize: 15, marginBottom: 14 }}>Deleting your account removes your profile, decks, slide images, reports and ratings permanently. This can&apos;t be undone.</P>
        <Button variant="record" iconLeft="trash-2" disabled={blocked} onClick={() => setConfirm(true)}>Delete account</Button>
      </Card>
      <Dialog open={confirm} title="Delete your account?" onClose={closeDelete} width={compact ? 360 : 480}
        actions={<><Button variant="secondary" onClick={closeDelete}>Cancel</Button><Button variant="record" disabled={typed !== "DELETE" || del.isPending} onClick={doDelete}>{del.isPending ? "Deleting…" : "Delete account"}</Button></>}>
        <P>All your decks, slide images, reports and ratings will be removed permanently. This can&apos;t be undone.</P>
        <div style={{ marginTop: 14 }}><Input label="Type DELETE to confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} /></div>
        {delErr && <div style={{ marginTop: 12 }}><Notice tone="danger" title="We couldn't delete your account">{delErr.code === "blocked" ? "Your account is paused." : "Please try again."}</Notice></div>}
      </Dialog>
    </StudentShell>
  );
}
