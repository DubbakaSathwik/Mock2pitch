"use client";
import { useState } from "react";
import { Button } from "@/components/ds/Button";
import { Dialog } from "@/components/ds/Dialog";
import { useToast } from "@/components/ds/Toast";
import { Notice } from "@/components/app/Notice";
import { P } from "@/components/app/Typography";
import { activeDeckHref, useActiveDeck, useCancelDeck } from "@/features/decks/queries";
import { toAppError } from "@/lib/data/errors";
import { useGo } from "@/lib/use-go";

/**
 * The deck the student has not finished, with the two ways out: continue it where it stands, or cancel it (after a confirmation) so a
 * new one can be uploaded. Shown on the upload screen when a new upload is refused ("Finish your current deck first") and on the dashboard.
 * `onCancelled` runs after a successful cancel (the upload screen retries the file the student had chosen).
 */
export function ActiveDeckPanel({ tone = "warning", onCancelled, intro }: { tone?: "warning" | "info"; onCancelled?: () => void; intro?: string }) {
  const active = useActiveDeck();
  const cancel = useCancelDeck();
  const { toast } = useToast();
  const { go, pending } = useGo();
  const [confirm, setConfirm] = useState(false);
  const d = active.data;
  if (!d) return null;
  const doCancel = () => cancel.mutate(d.deck_id, {
    onSuccess: () => { setConfirm(false); void active.refetch(); toast("Deck cancelled. You can upload a new one now."); onCancelled?.(); },
  });
  const err = cancel.error ? toAppError(cancel.error) : null;
  const where = d.status === "processing" ? "is still being read" : "is uploaded and waiting for your details";
  return (
    <div data-testid="active-deck">
      <Notice tone={tone} title={intro ?? "You have a deck in progress"}>
        &ldquo;{d.title}&rdquo; {where}. Continue it, or cancel it to start a new one.
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <Button size="sm" loading={pending} onClick={() => go(activeDeckHref(d))}>Go to that deck</Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>Cancel that deck</Button>
        </div>
      </Notice>
      <Dialog open={confirm} title="Cancel this deck?" onClose={() => setConfirm(false)} width={460}
        actions={<><Button variant="secondary" onClick={() => setConfirm(false)} disabled={cancel.isPending}>Keep it</Button><Button variant="record" loading={cancel.isPending} onClick={doCancel}>Cancel deck</Button></>}>
        <P>&ldquo;{d.title}&rdquo; and its slides will be discarded. The practice session it used today is not given back.</P>
        {err && <div role="alert" style={{ color: "var(--danger-text)", marginTop: 8, fontSize: 14 }}>{err.code === "invalid_state" ? "That deck has just finished, so it can't be cancelled. Reload the page." : "We couldn't cancel it. Try again."}</div>}
      </Dialog>
    </div>
  );
}
