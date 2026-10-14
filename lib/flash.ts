// A one-shot message that survives a hard navigation (e.g. "Your account was deleted" shown on the Landing page).
const KEY = "m2p.flash";
export function setFlash(message: string) { try { sessionStorage.setItem(KEY, message); } catch { /* ignore */ } }
export function consumeFlash(): string | null {
  try { const v = sessionStorage.getItem(KEY); if (v) sessionStorage.removeItem(KEY); return v; } catch { return null; }
}
