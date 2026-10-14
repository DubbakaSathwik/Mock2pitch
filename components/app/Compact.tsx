"use client";
import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from "react";

/** One breakpoint, measured on the app container (#m2p-root), not the window: compact = width < 760 (handoff §4). */
export const COMPACT_BELOW = 760;
type CompactValue = { compact: boolean; width: number };
const Ctx = createContext<CompactValue>({ compact: false, width: 1200 });
export const useCompact = () => useContext(Ctx).compact;
export const useContainerWidth = () => useContext(Ctx).width;

export function CompactProvider({ children, initialWidth }: { children: ReactNode; initialWidth?: number }) {
  const [width, setWidth] = useState(initialWidth ?? 1200);
  useLayoutEffect(() => {
    if (initialWidth !== undefined) return;
    const el = document.getElementById("m2p-root");
    if (!el) return;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    if (typeof ResizeObserver === "undefined") { window.addEventListener("resize", read); return () => window.removeEventListener("resize", read); }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [initialWidth]);
  return <Ctx.Provider value={{ compact: width < COMPACT_BELOW, width }}>{children}</Ctx.Provider>;
}
