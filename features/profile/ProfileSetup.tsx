"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BRANCHES, COLLEGE_YEARS } from "@shared/constants.ts";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { Input } from "@/components/ds/Input";
import { Select } from "@/components/ds/Select";
import { Avatar } from "@/components/app/Avatar";
import { useCompact } from "@/components/app/Compact";
import { Center } from "@/components/app/shells";
import { H, Muted, Overline, P } from "@/components/app/Typography";
import { toAppError } from "@/lib/data/errors";
import { safeNext } from "@/lib/safe-next";
import { useAuthSession } from "@/features/auth/queries";
import { useMyProfile, useUpdateProfile } from "./queries";
import { profileSchema } from "./schema";
import styles from "./ProfileSetup.module.css";
import { useGo } from "@/lib/use-go";

/** S4 Profile setup (shown once, before the first practice). */
export function ProfileSetup() {
  const compact = useCompact();
  const router = useRouter();
  const nav = useGo();
  const next = safeNext(useSearchParams().get("next"));
  const session = useAuthSession();
  const profile = useMyProfile();
  const update = useUpdateProfile();
  const [f, setF] = useState<{ full_name: string; college: string; year: string; branch: string }>({ full_name: "", college: "", year: COLLEGE_YEARS[0], branch: BRANCHES[0] });
  const [touchedName, setTouchedName] = useState(false);
  const [err, setErr] = useState("");
  const [nameErr, setNameErr] = useState("");
  useEffect(() => { if (profile.data?.profile_completed_at) router.replace(next); }, [profile.data, next, router]);
  // The name starts as the one from the Google account; the student can change it. (The photo always comes from Google.)
  const googleName = profile.data?.full_name ?? session.data?.fullName ?? "";
  useEffect(() => { if (!touchedName && googleName) setF((x) => ({ ...x, full_name: googleName })); }, [googleName, touchedName]);
  const name = f.full_name.trim() || googleName || session.data?.email || "You";
  const save = () => {
    const r = profileSchema.safeParse(f);
    if (!r.success) {
      setNameErr(r.error.issues.find((i) => i.path[0] === "full_name")?.message ?? "");
      setErr(r.error.issues.find((i) => i.path[0] === "college")?.message ?? "");
      if (!r.error.issues.some((i) => i.path[0] === "full_name" || i.path[0] === "college")) setErr("Check your details");
      return;
    }
    update.mutate(r.data, { onSuccess: () => nav.go(next, { replace: true }) });
  };
  const failure = update.error ? toAppError(update.error) : null;
  return (
    <Center w={560}>
      <Card padding={compact ? 22 : 36}>
        <Overline>Step 2 of 2</Overline>
        <H l={1} style={{ fontSize: 28, margin: "8px 0 6px" }}>Tell us a little about you</H>
        <P style={{ marginBottom: 22 }}>This helps us tailor examples. Only you and the product owner can see it.</P>
        <div className={styles.id}>
          <Avatar name={name} src={session.data?.avatarUrl} size={52} />
          <div><div className={styles.name}>{name}</div><Muted>{session.data?.email} · name and photo from Google</Muted></div>
        </div>
        <form className={styles.form} noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
          <Input label="Your name" value={f.full_name} error={nameErr} autoComplete="name" maxLength={80} onChange={(e) => { setTouchedName(true); setF({ ...f, full_name: e.target.value }); setNameErr(""); }} />
          <Input label="College" placeholder="e.g. RV Institute of Technology" value={f.college} error={err} autoComplete="organization" onChange={(e) => { setF({ ...f, college: e.target.value }); setErr(""); }} />
          <div className={styles.two}>
            <Select label="Year" options={COLLEGE_YEARS} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
            <Select label="Branch" options={BRANCHES} value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} />
          </div>
          {failure && <div role="alert" className={styles.fail}><Icon name="triangle-alert" size={18} color="var(--danger-500)" />{failure.code === "blocked" ? "Your account is paused." : "We couldn't save your details. Try again."}</div>}
          <Button type="submit" fullWidth style={{ marginTop: 8 }} loading={update.isPending || nav.pending}>{update.isPending || nav.pending ? "Saving…" : "Save and continue"}</Button>
        </form>
      </Card>
    </Center>
  );
}
