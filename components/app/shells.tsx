"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/components/ds/Card";
import { Icon, type IconName } from "@/components/ds/Icon";
import { IconButton } from "@/components/ds/IconButton";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { Badge } from "@/components/ds/Badge";
import { Avatar } from "./Avatar";
import { useCompact } from "./Compact";
import { Logo } from "./Logo";
import { H, Muted, P } from "./Typography";
import { useAuthSession, useSignOut } from "@/features/auth/queries";
import { useDashboardStats } from "@/features/dashboard/queries";
import { useStartPractice } from "@/features/dashboard/useStartPractice";
import { useMyProfile } from "@/features/profile/queries";
import styles from "./shells.module.css";

export type StudentNav = "dashboard" | "upload" | "history" | "settings";

/** Student shell: 248 px sidebar on desktop; 56 px top bar + bottom tab bar on mobile (handoff §5/§6). */
export function StudentShell({ active, maxW = 1200, children }: { active: StudentNav; maxW?: number; children: ReactNode }) {
  const compact = useCompact();
  const start = useStartPractice();
  const stats = useDashboardStats();
  const session = useAuthSession();
  const profile = useMyProfile();
  const name = profile.data?.full_name ?? session.data?.fullName ?? session.data?.email ?? "You";
  const items: { key: StudentNav; label: string; icon: IconName; href: string }[] = [
    { key: "dashboard", label: "Home", icon: "house", href: "/dashboard" },
    { key: "upload", label: "New practice", icon: "circle-plus", href: start.href },
    { key: "history", label: "History", icon: "history", href: "/history" },
    { key: "settings", label: "Profile", icon: "user", href: "/settings" },
  ];
  if (compact) {
    return (
      <div className={styles.mRoot}>
        <header className={styles.mTop}><Logo size={18} /><Link href="/settings" aria-label="Profile and settings"><Avatar name={name} src={profile.data?.avatar_url} size={32} /></Link></header>
        <main id="main" className={styles.mMain}>{children}</main>
        <nav className={styles.mTabs} aria-label="Main">
          {items.map((it) => (
            <Link key={it.key} href={it.href} aria-current={active === it.key ? "page" : undefined} className={`${styles.mTab} ${active === it.key ? styles.mTabOn : ""}`}><Icon name={it.icon} size={22} />{it.label}</Link>
          ))}
        </nav>
      </div>
    );
  }
  return (
    <div className={styles.root}>
      <aside className={styles.aside}>
        <div className={styles.logo}><Logo /></div>
        <nav aria-label="Main" className={styles.nav}>
          {items.map((it) => (
            <Link key={it.key} href={it.href} aria-current={active === it.key ? "page" : undefined} className={`${styles.navItem} ${active === it.key ? styles.navOn : ""}`}><Icon name={it.icon} size={20} />{it.label}</Link>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <Card variant="sunken" padding={16}>
          <Muted style={{ marginBottom: 8 }}>Practice sessions today</Muted>
          <ProgressBar value={stats.data?.sessions_used_today ?? 0} max={stats.data?.daily_limit ?? 5} valueLabel={`${stats.data?.sessions_used_today ?? 0} of ${stats.data?.daily_limit ?? 5}`} ariaLabel="Practice sessions used today" />
        </Card>
        <div className={styles.user}>
          <Avatar name={name} src={profile.data?.avatar_url} size={36} />
          <div style={{ minWidth: 0 }}>
            <div className={styles.userName}>{name}</div>
            <Muted style={{ fontSize: 12 }}>{[profile.data?.year, profile.data?.branch].filter(Boolean).join(" · ")}</Muted>
          </div>
        </div>
      </aside>
      <main id="main" className={styles.main}><div style={{ maxWidth: maxW, margin: "0 auto" }}>{children}</div></main>
    </div>
  );
}

const STEPS = [["upload", "Upload"], ["prep", "Prepare"], ["time", "Time"], ["mic", "Mic check"]] as const;
export type FlowStep = (typeof STEPS)[number][0];

/** Flow shell (Upload → Prepare → Time → Mic check): top bar with a 4-step stepper and an exit button. */
export function FlowShell({ step, wide, children }: { step: FlowStep; wide?: boolean; children: ReactNode }) {
  const compact = useCompact();
  const idx = STEPS.findIndex((s) => s[0] === step);
  return (
    <div className={styles.flow}>
      <header className={styles.flowBar}>
        <Logo size={compact ? 16 : 22} />
        <ol className={styles.stepper} aria-label="Progress">
          {STEPS.map(([k, l], i) => (
            <li key={k} aria-current={i === idx ? "step" : undefined} className={`${styles.step} ${i <= idx ? styles.stepOn : ""} ${i === idx ? styles.stepCur : ""}`}>
              <span className={`${styles.dot} ${i < idx ? styles.dotDone : i === idx ? styles.dotCur : ""}`}>{i < idx ? <Icon name="check" size={13} /> : i + 1}</span>
              <span className={compact ? "sr-only" : undefined}>{l}</span>
            </li>
          ))}
        </ol>
        <Link href="/dashboard" aria-label="Exit to dashboard" title="Exit to dashboard" className={styles.exit}><Icon name="x" size={19} /></Link>
      </header>
      <main id="main" className={styles.flowMain}><div style={{ maxWidth: wide ? 1280 : 760, margin: "0 auto" }}>{children}</div></main>
    </div>
  );
}

const ADMIN_NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Overview", icon: "layout-dashboard" }, { href: "/admin/students", label: "Students", icon: "users" },
  { href: "/admin/ratings", label: "Ratings", icon: "star" }, { href: "/admin/ai-usage", label: "AI usage", icon: "cpu" }, { href: "/admin/terms", label: "Terms", icon: "file-text" },
];

/** Admin shell: Prussian sidebar on desktop; Prussian top bar + 5-column bottom bar on mobile. */
export function AdminShell({ active, children }: { active: string; children: ReactNode }) {
  const compact = useCompact();
  const router = useRouter();
  const signOut = useSignOut();
  const out = () => signOut.mutate(undefined, { onSuccess: () => router.replace("/") });
  if (compact) {
    return (
      <div className={styles.mRoot}>
        <header className={`${styles.mTop} ${styles.aTop}`}><Logo dark size={17} /><Badge tone="violet">Owner admin</Badge></header>
        <main id="main" className={styles.mMain}>{children}</main>
        <nav className={`${styles.mTabs} ${styles.aTabs}`} aria-label="Admin">
          {ADMIN_NAV.map((it) => <Link key={it.href} href={it.href} aria-current={active === it.href ? "page" : undefined} className={`${styles.mTab} ${styles.aTab} ${active === it.href ? styles.aTabOn : ""}`}><Icon name={it.icon} size={20} />{it.label}</Link>)}
        </nav>
      </div>
    );
  }
  return (
    <div className={styles.root}>
      <aside className={`${styles.aside} ${styles.asideDark}`}>
        <div className={styles.logo} style={{ paddingBottom: 6 }}><Logo dark /></div>
        <div style={{ padding: "0 8px 20px" }}><Badge tone="violet">Owner admin</Badge></div>
        <nav aria-label="Admin" className={styles.nav}>
          {ADMIN_NAV.map((it) => <Link key={it.href} href={it.href} aria-current={active === it.href ? "page" : undefined} className={`${styles.navItem} ${styles.navDark} ${active === it.href ? styles.navDarkOn : ""}`}><Icon name={it.icon} size={20} />{it.label}</Link>)}
        </nav>
        <div style={{ flex: 1 }} />
        <button type="button" className={`${styles.navItem} ${styles.navDark}`} onClick={out}><Icon name="log-out" size={20} />Sign out</button>
      </aside>
      <main id="main" className={styles.main}><div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div></main>
    </div>
  );
}

/** Centred single-card layout (sign in, terms, profile, limit …). */
export function Center({ w = 460, children }: { w?: number; children: ReactNode }) {
  return <main id="main" className={styles.center}><div style={{ width: "100%", maxWidth: w }}>{children}</div></main>;
}

/** Page head: title (h1), optional sub and a right-hand action; stacks on mobile. */
export function Head({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className={styles.head}>
      <div><H l={1} className={styles.headTitle}>{title}</H>{sub && <P style={{ marginTop: 6, color: "var(--text-muted)" }}>{sub}</P>}</div>
      {right}
    </div>
  );
}

export { IconButton };
