import type { Page } from "@playwright/test";

/** Counts Realtime `postgres_changes` frames the browser actually received, per table (proves events — not just polling — reached the page). */
export function watchRealtime(page: Page) {
  const seen = { decks: 0, practice_sessions: 0, frames: 0, sockets: 0 };
  page.on("websocket", (ws) => {
    if (!ws.url().includes("/realtime/v1/websocket")) return;
    seen.sockets++;
    ws.on("framereceived", (f) => {
      const t = typeof f.payload === "string" ? f.payload : "";
      if (!t.includes("postgres_changes")) return;
      seen.frames++;
      if (t.includes('"table":"decks"')) seen.decks++;
      if (t.includes('"table":"practice_sessions"')) seen.practice_sessions++;
    });
  });
  return seen;
}
