"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon, type IconName } from "@/components/ds/Icon";
import { ScoreRing } from "@/components/ds/ScoreRing";
import { Bar } from "@/components/app/Bar";
import { GoogleButton } from "@/components/app/GoogleButton";
import { Logo } from "@/components/app/Logo";
import { JURY, Person, SelfTile } from "@/components/app/Person";
import { SlideView } from "@/components/app/SlideView";
import { Tile } from "@/components/app/Tile";
import { H, Muted, Overline, P } from "@/components/app/Typography";
import { scoreColor } from "@/lib/score";
import styles from "./Landing.module.css";

const SUBS: [string, number][] = [["Timing", 82], ["Filler words", 58], ["Slide coverage", 78], ["Clarity", 75]];

function ReportPreview() {
  return (
    <Card padding={24} className={styles.reportCard} aria-label="Example feedback report">
      <div className={styles.reportTop}>
        <ScoreRing value={74} size={110} stroke={10} label="of 100" />
        <div className={styles.reportHead}>
          <Badge tone="success">+12 from attempt 1</Badge>
          <div className={styles.reportTitle}>Clear and confident. Trim the filler words in the middle.</div>
        </div>
      </div>
      <div className={styles.reportBars}>
        {SUBS.map(([l, v]) => (
          <div key={l} className={styles.reportRow}><span>{l}</span><Bar v={v} color={scoreColor(v)} /><b>{v}</b></div>
        ))}
        <div className={styles.reportRow}><span>Pace</span><span className={styles.pace}>162 wpm · info only</span><span /></div>
      </div>
    </Card>
  );
}

function RoomPreview() {
  return (
    <div className={styles.room} aria-label="Example practice room">
      <div className={styles.roomMain}>
        <SlideView src="/landing/room-slide.jpg" alt="Example slide: How it works" flat radius={6} />
        <div className={styles.roomDock} aria-hidden="true">
          {(["chevron-left", "mic", "play", "chevron-right"] as IconName[]).map((x, i) => (
            <span key={x} className={`${styles.dockBtn} ${i === 1 ? styles.dockRec : ""}`}><Icon name={x} size={15} /></span>
          ))}
        </div>
      </div>
      <div className={styles.roomRail}>
        {[0, 1, 2].map((k) => <Person key={k} k={k} label={JURY[k]!.name} role={JURY[k]!.role} small />)}
        <SelfTile name="You" speaking={false} small level={0} />
      </div>
    </div>
  );
}

export function Landing() {
  const router = useRouter();
  const steps: [IconName, string, string][] = [
    ["upload", "Upload slides", "A PDF of up to 10 slides. We read each slide and suggest key points and a script for it."],
    ["mic", "Practice out loud", "Set your time, then present slide by slide to a quiet room of jury members. Audio only."],
    ["chart-line", "Get your report", "A score out of 100, what you did well, and the top 3 things to fix next time."],
  ];
  return (
    <div className={styles.page}>
      <header className={styles.header}><Logo /><Button variant="secondary" size="sm" onClick={() => router.push("/sign-in")}>Sign in</Button></header>
      <main id="main">
        <section className={styles.hero}>
          <div>
            <Overline>Practice • Improve • Pitch</Overline>
            <h1 className={styles.h1}>Rehearse your pitch in private. Walk in ready.</h1>
            <P style={{ fontSize: 18, maxWidth: 520 }}>Upload your slides, present out loud to a calm virtual jury, and get honest, encouraging feedback before the real one.</P>
            <div className={styles.cta}><GoogleButton onClick={() => router.push("/sign-in")} /><Muted>Free to start · Audio only, no camera · English</Muted></div>
          </div>
          <div className={styles.heroArt}>
            <RoomPreview />
            <div className={styles.heroCard}><ReportPreview /></div>
          </div>
        </section>
        <section className={styles.how}>
          <div className={styles.inner}>
            <Overline>How it works</Overline>
            <H l={1} as="h2" className={styles.sectionTitle}>Three steps from slides to feedback</H>
            <div className={styles.steps}>
              {steps.map(([ic, t, d], i) => (
                <Card key={t} padding={24} as="article">
                  <div className={styles.stepTop}><Tile icon={ic} /><span className={styles.stepNo}>Step {i + 1}</span></div>
                  <H l={2} as="h3" style={{ fontSize: 21, marginBottom: 8 }}>{t}</H>
                  <P>{d}</P>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className={styles.two}>
          <div className={`${styles.inner} ${styles.twoGrid}`}>
            <div><Overline>Practice room</Overline><H l={2} className={styles.sub}>Present like it is the real thing</H><P style={{ marginBottom: 20 }}>A meeting-style room with a quiet jury, a timer per slide and one recording per slide. You can re-record any slide before you submit.</P><RoomPreview /></div>
            <div><Overline>Feedback report</Overline><H l={2} className={styles.sub}>Specific, kind and easy to act on</H><P style={{ marginBottom: 20 }}>Scores for timing, filler words, slide coverage and clarity, plus your pace in words per minute, with a breakdown for every slide.</P><ReportPreview /></div>
          </div>
        </section>
        <section className={styles.privacy}>
          <div className={styles.band}>
            <div>
              <Overline color="var(--icy-blue)">Private by design</Overline>
              <h2 className={styles.bandTitle}>Practise alone. Nobody is watching.</h2>
              <P style={{ color: "var(--icy-blue)" }}>Your audio is deleted as soon as your report is ready. Only your report stays, and only you can see it.</P>
            </div>
            <ul className={styles.bandList}>
              {([["mic", "Audio only. No camera, ever."], ["trash-2", "Audio deleted after your report"], ["lock", "Reports are visible only to you"]] as [IconName, string][]).map(([ic, t]) => (
                <li key={t}><Icon name={ic} size={20} color="var(--icy-blue)" />{t}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <Logo size={18} />
        <nav aria-label="Footer" className={styles.footLinks}>
          <Link href="/terms?from=landing">Terms</Link><Link href="/privacy?from=landing">Privacy Policy</Link><Link href="/admin/sign-in">Owner sign in</Link>
        </nav>
      </footer>
    </div>
  );
}
