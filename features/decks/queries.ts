"use client";
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";
import type { DeckSummary } from "@/lib/data/types";

export const useDecks = () => useQuery({ queryKey: qk.decks, queryFn: () => getData().decks.list() });
export const useDeck = (id: string | undefined) => useQuery({ queryKey: qk.deck(id ?? ""), queryFn: () => getData().decks.get(id!), enabled: !!id });
export const useDeckAttempts = (id: string | undefined) => useQuery({ queryKey: qk.deckAttempts(id ?? ""), queryFn: () => getData().decks.attempts(id!), enabled: !!id });

/** Slide images by index. `refetch` fetches fresh signed URLs (used once when an image fails, e.g. an expired URL). */
export function useSlideImages(deckId: string | undefined, enabled = true) {
  const q = useQuery({
    queryKey: qk.slideImages(deckId ?? ""),
    queryFn: () => getData().decks.getAssetUrls(deckId!, ["slide_image"]),
    enabled: !!deckId && enabled, staleTime: 4 * 60_000,
  });
  const urls = useMemo(() => {
    const m = new Map<number, string>();
    for (const f of q.data?.files ?? []) if (f.kind === "slide_image" && f.slide_index !== null) m.set(f.slide_index, f.url);
    return m;
  }, [q.data]);
  const refetch = useCallback(() => { void q.refetch(); }, [q]);
  return { urls, isLoading: q.isLoading, refetch, error: q.error };
}

/** Optimistic pin toggle; rolls back on error. Pinned decks sort first. */
export function usePinDeck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deckId, pinned }: { deckId: string; pinned: boolean }) => getData().decks.setPinned(deckId, pinned),
    onMutate: async ({ deckId, pinned }) => {
      await qc.cancelQueries({ queryKey: qk.decks });
      const prev = qc.getQueryData<DeckSummary[]>(qk.decks);
      if (prev) {
        const next = prev.map((d) => (d.deck_id === deckId ? { ...d, pinned, pinned_at: pinned ? new Date().toISOString() : null } : d));
        next.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.pinned_at ?? "").localeCompare(a.pinned_at ?? ""));
        qc.setQueryData(qk.decks, next);
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(qk.decks, ctx.prev); },
    onSettled: () => { void qc.invalidateQueries({ queryKey: qk.decks }); },
  });
}
