// Starts the data of the route being opened in parallel with the gate's own session/profile/policy checks, so the page does not wait for
// them (gate -> page was a 4-round-trip waterfall). Only runs when the adapter reports a local session; failures are ignored (the page's
// own queries surface errors). Query keys and functions match the page hooks exactly, so their mount is a cache hit.
import type { QueryClient } from "@tanstack/react-query";
import { getData } from "@/lib/data";
import { qk } from "@/lib/query";

export function prefetchForPath(qc: QueryClient, pathname: string): void {
  if (!getData().auth.peek?.()) return;
  const d = getData();
  const go = (queryKey: readonly unknown[], queryFn: () => Promise<unknown>) => { void qc.prefetchQuery({ queryKey, queryFn }); };
  let m: RegExpMatchArray | null;
  if (pathname === "/dashboard") {
    go(qk.stats, () => d.dashboard.getStats()); go(qk.decks, () => d.decks.list()); go(qk.recentReports(8), () => d.dashboard.listRecentReports(8));
  } else if ((m = pathname.match(/^\/reports\/([^/]+)$/))) {
    go(qk.report(m[1]!), () => d.reports.get(m![1]!));
  } else if (pathname === "/history") {
    go(qk.decks, () => d.decks.list());
  } else if ((m = pathname.match(/^\/history\/([^/]+)$/))) {
    go(qk.deck(m[1]!), () => d.decks.get(m![1]!)); go(qk.deckAttempts(m[1]!), () => d.decks.attempts(m![1]!));
  } else if ((m = pathname.match(/^\/practice\/([^/]+)\/(prepare|time)$/))) {
    go(qk.deck(m[1]!), () => d.decks.get(m![1]!));
  }
}
