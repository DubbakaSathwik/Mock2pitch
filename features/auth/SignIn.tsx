"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { Center } from "@/components/app/shells";
import { GoogleButton } from "@/components/app/GoogleButton";
import { Logo } from "@/components/app/Logo";
import { H, Muted, P } from "@/components/app/Typography";
import { LoadingShell } from "@/components/app/Loading";
import { decideSignedIn } from "@/features/guards/gate";
import { safeNext } from "@/lib/safe-next";
import { useAuthSession, useSignIn } from "./queries";
import styles from "./SignIn.module.css";

/** S2 (student) and A0 (owner) sign in. Google only. Preserves the intended destination via ?next=. */
export function SignIn({ owner }: { owner?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const session = useAuthSession();
  const signIn = useSignIn();
  const d = decideSignedIn({ session: session.isPending ? undefined : session.data ?? null, next });
  useEffect(() => { if (d.status === "redirect") router.replace(d.to); }, [d, router]);
  if (d.status !== "allow") return <LoadingShell />;
  const failed = signIn.isError || params.get("error");
  return (
    <Center>
      <Card padding={36} className={styles.card}>
        <div className={styles.logo}><Logo /></div>
        {owner && <div className={styles.badge}><Badge tone="violet">Owner admin</Badge></div>}
        <H l={1} className={styles.title}>{owner ? "Owner sign in" : "Welcome back"}</H>
        <P style={{ margin: owner ? "10px 0 26px" : "10px 0 28px" }}>{owner ? "Only the owner's Google account can open the admin area." : "Sign in to practise your next presentation."}</P>
        {failed && <div role="alert" className={styles.err}><Icon name="triangle-alert" size={18} color="var(--danger-500)" />Sign-in didn&apos;t finish. Try again.</div>}
        <GoogleButton pending={signIn.isPending} onClick={() => signIn.mutate({ next, hint: owner ? "owner" : undefined })} />
        {!owner && <div className={styles.note}><Icon name="shield-check" size={18} color="var(--bright-marine)" /><Muted>Practice is private. Audio is deleted after your report.</Muted></div>}
        <Link href="/" className={styles.back}>Back to home</Link>
      </Card>
    </Center>
  );
}
