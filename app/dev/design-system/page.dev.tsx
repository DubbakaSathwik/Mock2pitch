"use client";
// Dev-only (`*.dev.tsx` pages do not exist in production builds): every design-system component and state.
import { useState } from "react";
import { Badge, Button, Card, Checkbox, Dialog, Icon, ICON_NAMES, IconButton, Input, LevelMeter, ProgressBar, RecordButton, ScoreRing, Select, Tabs, Tooltip, useToast } from "@/components/ds";
import type { ButtonVariant, BadgeTone } from "@/components/ds";
import { AIBadge } from "@/components/app/AIBadge";
import { Avatar } from "@/components/app/Avatar";
import { Bar } from "@/components/app/Bar";
import { BarChart } from "@/components/app/BarChart";
import { Doc } from "@/components/app/Doc";
import { FillerText } from "@/components/app/FillerText";
import { GoogleButton } from "@/components/app/GoogleButton";
import { LineChart } from "@/components/app/LineChart";
import { Logo } from "@/components/app/Logo";
import { MicMeter } from "@/components/app/MicMeter";
import { Notice } from "@/components/app/Notice";
import { JURY, Person, SelfTile } from "@/components/app/Person";
import { SlideView } from "@/components/app/SlideView";
import { StarRating, Stars } from "@/components/app/Stars";
import { Stat } from "@/components/app/Stat";
import { Tile } from "@/components/app/Tile";
import { H, Muted, Overline, P } from "@/components/app/Typography";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "accent", "inverse", "record"];
const TONES: BadgeTone[] = ["neutral", "info", "success", "warning", "danger", "violet", "solid"];
const Sec = ({ title, children, dark }: { title: string; children: React.ReactNode; dark?: boolean }) => (
  <section style={{ margin: "32px 0", padding: dark ? 24 : 0, background: dark ? "var(--prussian-blue)" : "transparent", borderRadius: 16 }}>
    <H l={2} style={{ marginBottom: 14, color: dark ? "#fff" : undefined }}>{title}</H><div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>{children}</div>
  </section>
);

export default function DesignSystem() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("a");
  const [pill, setPill] = useState("terms");
  const [chk, setChk] = useState(false);
  const [stars, setStars] = useState(3);
  const [rec, setRec] = useState(false);
  return (
    <main id="main" style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 120px" }}>
      <Overline>Dev only</Overline><H l={1}>Design system</H><Muted>Every component and state. This page does not exist in production builds.</Muted>
      <Sec title="Logo"><Logo /><div style={{ background: "var(--prussian-blue)", padding: 16, borderRadius: 12 }}><Logo dark /></div></Sec>
      <Sec title="Typography"><div><Overline>Overline</Overline><H l={1}>Heading 1</H><H l={2}>Heading 2</H><H l={3}>Heading 3</H><P>Body text in LXGW WenKai TC.</P><Muted>Muted caption text</Muted></div></Sec>
      <Sec title="Buttons">{VARIANTS.map((v) => <Button key={v} variant={v}>{v}</Button>)}{VARIANTS.map((v) => <Button key={v + "d"} variant={v} disabled>{v} disabled</Button>)}<Button size="sm">Small</Button><Button size="lg" iconLeft="plus">Large</Button><Button iconRight="arrow-right">Icon right</Button></Sec>
      <Sec title="Icon buttons"><IconButton icon="x" label="Close" /><IconButton icon="play" label="Play" variant="secondary" size={44} /><IconButton icon="mic" label="Mic" variant="primary" size={48} /><div style={{ background: "var(--prussian-blue)", padding: 8, borderRadius: 99 }}><IconButton icon="rotate-ccw" label="Re-record" variant="inverse" /></div></Sec>
      <Sec title="Badges">{TONES.map((t) => <Badge key={t} tone={t}>{t}</Badge>)}<Badge tone="danger" dot>Recording</Badge><AIBadge /></Sec>
      <Sec title="Cards"><Card>default</Card><Card variant="sunken">sunken</Card><Card variant="accent">accent</Card><Card interactive>interactive (hover)</Card></Sec>
      <Sec title="Forms">
        <Input label="Input" placeholder="Placeholder" /><Input label="With error" error="Enter your college name" defaultValue="" /><Input label="With icon" icon="search" placeholder="Search" />
        <Select label="Select" options={["3rd year", "4th year", "Other"]} defaultValue="3rd year" /><Checkbox checked={chk} onChange={setChk} label="Checkbox label" />
      </Sec>
      <Sec title="Progress and scores"><div style={{ width: 280 }}><ProgressBar value={3} max={5} valueLabel="3 of 5" label="Practice sessions" /></div><div style={{ width: 280 }}><ProgressBar value={80} tone="warning" /></div><ScoreRing value={74} label="out of 100" /><ScoreRing value={62} size={96} stroke={9} label={null} color="var(--warning-500)" /><Bar v={64} /></Sec>
      <Sec title="Tabs"><Tabs items={["a", "b", "c"]} value={tab} onChange={setTab} /><Tabs variant="underline" items={["a", "b", "c"]} value={tab} onChange={setTab} /><Tabs variant="pill" items={[{ value: "terms", label: "Terms" }, { value: "privacy", label: "Privacy Policy" }]} value={pill} onChange={setPill} /></Sec>
      <Sec title="Overlays"><Button onClick={() => setOpen(true)}>Open dialog</Button><Button variant="secondary" onClick={() => toast("Profile saved")}>Toast</Button><Tooltip content="Tooltip text"><Button variant="ghost">Hover or focus me</Button></Tooltip></Sec>
      <Dialog open={open} title="Leave this session?" onClose={() => setOpen(false)} width={440} actions={<><Button variant="secondary" onClick={() => setOpen(false)}>Keep practising</Button><Button variant="record" onClick={() => setOpen(false)}>Leave session</Button></>}><P>Your recordings for this session will be discarded.</P></Dialog>
      <Sec title="Notices"><div style={{ width: "100%", display: "grid", gap: 10 }}><Notice title="Upload failed">The upload was interrupted.</Notice><Notice tone="warning">3 slides are not recorded yet.</Notice><Notice tone="info">Use Chrome for the best results.</Notice></div></Sec>
      <Sec title="Recording"><RecordButton recording={rec} onToggle={() => setRec(!rec)} /><LevelMeter levels={[0.2, 0.5, 0.8, 0.4, 0.6, 0.9, 0.3]} /><div style={{ width: 400 }}><MicMeter level={0.5} /></div></Sec>
      <Sec title="Stars"><Stars n={4} /><StarRating value={stars} onChange={setStars} /></Sec>
      <Sec title="Avatar and tiles"><Avatar name="Ananya Rao" /><Avatar name="Ananya Rao" src="/broken.png" size={56} /><Tile icon="mic" /><Tile icon="sparkles" tone="violet" /><Stat icon="users" label="Total students" value="412" sub="Signed in with Google" /></Sec>
      <Sec title="Slide view (skeleton, image, broken)"><div style={{ width: 240 }}><SlideView alt="loading" /></div><div style={{ width: 240 }}><SlideView src="/mock/slides/parksense-2.jpg" alt="Slide 2" /></div><div style={{ width: 240 }}><SlideView src="/does-not-exist.jpg" alt="Broken" /></div></Sec>
      <Sec title="Charts"><div style={{ width: 420 }}><LineChart data={[{ label: "Attempt 1", value: 62 }, { label: "Attempt 2", value: 74 }]} /></div><div style={{ width: 420 }}><BarChart data={[18, 24, 22, 31, 28, 35, 41]} labels={["1", "2", "3", "4", "5", "6", "7"]} caption="Demo" values /></div></Sec>
      <Sec title="Jury room" dark><div style={{ width: 160 }}><Person k={0} label={JURY[0]!.name} role={JURY[0]!.role} /></div><div style={{ width: 160 }}><Person k={1} label={JURY[1]!.name} role={JURY[1]!.role} /></div><div style={{ width: 160 }}><SelfTile name="Ananya Rao" speaking level={0.6} /></div><div style={{ width: 160 }}><SelfTile name="Ananya Rao" level={0} /></div></Sec>
      <Sec title="Content"><div style={{ width: 420 }}><Doc text={"## 1. Heading\nBody line.\n\n## 2. Next\nMore text."} /></div><P><FillerText text="So um we built it and, you know, it basically works." /></P><GoogleButton /></Sec>
      <Sec title="Icons (55)">{ICON_NAMES.map((n) => <span key={n} title={n} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", width: 84, gap: 4, fontSize: 11, color: "var(--ink-600)" }}><Icon name={n} size={24} />{n}</span>)}</Sec>
    </main>
  );
}
