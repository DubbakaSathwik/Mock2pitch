// Tiny global store behind the thin progress bar at the top of the page: "a navigation has started and the next page is not on screen yet".
// Started by internal link clicks (NavProgress) and by useGo(); finished when the pathname or query string changes, or after a safety timeout.
type Listener = () => void;
let active = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export const navProgress = {
  start() {
    active = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => navProgress.done(), 12_000); // never leave the bar running if a navigation is cancelled or fails
    emit();
  },
  done() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (active) { active = false; emit(); }
  },
  isActive: () => active,
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};
