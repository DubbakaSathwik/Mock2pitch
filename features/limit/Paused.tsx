"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds/Button";
import { StudentShell } from "@/components/app/shells";
import { Tile } from "@/components/app/Tile";
import { H, P } from "@/components/app/Typography";
import { useSignOut } from "@/features/auth/queries";
import { useMyProfile } from "@/features/profile/queries";
import styles from "./Limit.module.css";

/** Blocked student screen: practice is paused, reports stay readable (History is still in the navigation). */
export function Paused() {
  const router = useRouter();
  const profile = useMyProfile();
  const signOut = useSignOut();
  useEffect(() => { if (profile.data && !profile.data.is_blocked) router.replace("/dashboard"); }, [profile.data, router]);
  return (
    <StudentShell active="dashboard">
      <div className={styles.wrap}>
        <div className={styles.tile}><Tile icon="ban" size={64} /></div>
        <H l={1}>Your account is paused</H>
        <P style={{ margin: "12px 0 24px" }}>The Mock2Pitch owner has paused your access. Your reports are still saved.</P>
        <div className={styles.actions}><Button variant="secondary" iconLeft="log-out" disabled={signOut.isPending} onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace("/") })}>Sign out</Button></div>
      </div>
    </StudentShell>
  );
}
