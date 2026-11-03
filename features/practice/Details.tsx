"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AUDIENCES, AUDIENCE_LABELS, MAX_ABSTRACT_WORDS, MAX_AUDIENCE_OTHER_CHARS, MAX_GOAL_CHARS } from "@shared/constants.ts";
import { countWords } from "@shared/schemas.ts";
import { Button } from "@/components/ds/Button";
import { Card } from "@/components/ds/Card";
import { Icon } from "@/components/ds/Icon";
import { Input } from "@/components/ds/Input";
import { Select } from "@/components/ds/Select";
import { Tabs } from "@/components/ds/Tabs";
import { Textarea } from "@/components/ds/Textarea";
import { Skeleton } from "@/components/app/Loading";
import { ErrorNotice } from "@/components/app/Notice";
import { FlowShell, Head } from "@/components/app/shells";
import { Muted } from "@/components/app/Typography";
import { errorUi } from "@/features/errors/map";
import { getData } from "@/lib/data";
import { toAppError } from "@/lib/data/errors";
import { qk } from "@/lib/query";
import { useGo } from "@/lib/use-go";
import { detailsFormSchema, toDeckDetails } from "./details-schema";
import styles from "./Details.module.css";

const PRESETS = [3, 5, 7, 10];
const AUDIENCE_OPTIONS = AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }));

/**
 * S6b Details: after the slides are uploaded and before they are read. Audience, goal and a short summary shape the key points and
 * script the AI writes; the time limit seeds the Time step (still editable there). Only "who" and "how long" are required.
 */
export function Details() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const { go, pending } = useGo();
  const status = useQuery({ queryKey: [...qk.deck(deckId), "status"], queryFn: () => getData().decks.getStatus(deckId), staleTime: 0 });
  const [f, setF] = useState({ audience: "student" as (typeof AUDIENCES)[number], audience_other: "", goal: "", abstract: "", minutes: "5" });
  const [errs, setErrs] = useState<Record<string, string>>({});

  // Only a deck that is waiting for its details belongs here; anything further along goes to where it is.
  const st = status.data?.status;
  useEffect(() => {
    if (!st) return;
    if (st === "processing" || st === "failed") router.replace(`/practice/${deckId}/reading`);
    else if (st === "ready") router.replace(`/practice/${deckId}/prepare`);
    else if (st === "awaiting_upload") router.replace("/practice/new");
  }, [st, deckId, router]);

  const start = useMutation({
    mutationFn: (details: ReturnType<typeof toDeckDetails>) => getData().upload.process(deckId, details),
    onSuccess: () => go(`/practice/${deckId}/reading`, { replace: true }),
  });
  const failure = start.error ? toAppError(start.error) : null;
  const ui = failure ? errorUi(failure.code, failure.details) : null;
  useEffect(() => { if (ui?.kind === "route") router.push(ui.to); }, [ui, router]);

  const words = countWords(f.abstract);
  const submit = () => {
    const r = detailsFormSchema.safeParse({ ...f, minutes: f.minutes.trim() === "" ? NaN : Number(f.minutes) });
    if (!r.success) {
      const next: Record<string, string> = {};
      for (const i of r.error.issues) { const k = String(i.path[0]); if (!next[k]) next[k] = i.message; }
      setErrs(next);
      return;
    }
    setErrs({});
    start.mutate(toDeckDetails(r.data));
  };
  const set = (patch: Partial<typeof f>) => { setF((x) => ({ ...x, ...patch })); setErrs({}); };
  const loadFailed = status.error ? errorUi(toAppError(status.error).code) : null;
  const busy = start.isPending || pending;

  return (
    <FlowShell step="details" back={{ href: "/practice/new", label: "Back to upload" }}>
      <Head title="About your presentation" sub="We write your key points and script for this audience and time. Only who you're presenting to and how long you have are required." />
      {status.isPending || (st && st !== "awaiting_images") ? <Skeleton h={360} r={16} /> : loadFailed?.kind === "inline" ? <ErrorNotice title={loadFailed.title} body={loadFailed.body} onRetry={() => status.refetch()} /> : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Card className={styles.card}>
            <Select label="Who are you presenting to?" options={AUDIENCE_OPTIONS} value={f.audience} error={errs.audience} onChange={(e) => set({ audience: e.target.value as typeof f.audience })} />
            {f.audience === "others" && (
              <Input label="Describe your audience" placeholder="e.g. Rotary club members, hiring managers" maxLength={MAX_AUDIENCE_OTHER_CHARS} value={f.audience_other} error={errs.audience_other} onChange={(e) => set({ audience_other: e.target.value })} />
            )}
            <Textarea label="Goal of your presentation (optional)" hint="e.g. win the hackathon, pass the viva, pitch for funding" maxLength={MAX_GOAL_CHARS} rows={2} value={f.goal} error={errs.goal} onChange={(e) => set({ goal: e.target.value })} />
            <Textarea label={`Short summary of your presentation (optional, up to ${MAX_ABSTRACT_WORDS} words)`} hint="What is it about, in your own words?" rows={3} value={f.abstract} error={errs.abstract} counter={`${words} / ${MAX_ABSTRACT_WORDS} words`} counterOver={words > MAX_ABSTRACT_WORDS} onChange={(e) => set({ abstract: e.target.value })} />
            <div className={styles.row}>
              <Input label="Total time (minutes)" type="number" inputMode="numeric" min={1} max={20} value={f.minutes} error={errs.minutes} onChange={(e) => set({ minutes: e.target.value })} wrapperClassName={styles.minutes} />
              <div className={errs.minutes ? styles.presetsErr : undefined}>
                <Tabs variant="pill" label="Presets" items={PRESETS.map((p) => ({ value: String(p), label: `${p} min` }))} value={f.minutes} onChange={(v) => set({ minutes: v })} />
              </div>
            </div>
          </Card>
          {failure && ui?.kind === "inline" && (
            <div className={styles.fail}>
              <ErrorNotice title={failure.code === "images_missing" ? "Some slide images didn't upload" : ui.title} body={failure.code === "images_missing" ? "Please upload your PDF again." : ui.body} onRetry={ui.retry && failure.code !== "images_missing" ? submit : undefined} />
              {failure.code === "images_missing" && <div style={{ marginTop: 12 }}><Link href="/practice/new"><Button variant="secondary">Upload again</Button></Link></div>}
            </div>
          )}
          <div className={styles.cta}>
            <Button type="submit" size="lg" iconRight="arrow-right" loading={busy}>{busy ? "Starting…" : "Read my slides"}</Button>
          </div>
          <div className={styles.note}><Icon name="info" size={18} color="var(--bright-marine)" /><Muted>Your slides are already uploaded. Going back to choose a different deck uses another of today&apos;s sessions.</Muted></div>
        </form>
      )}
    </FlowShell>
  );
}
