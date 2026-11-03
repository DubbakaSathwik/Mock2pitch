"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { navProgress } from "@/lib/nav-progress";
import styles from "./NavProgress.module.css";

/** Thin bar at the top of the window while a page change is in flight (internal link clicks and useGo()). Ends when the URL changes. */
export function NavProgress() {
  const active = useSyncExternalStore(navProgress.subscribe, navProgress.isActive, () => false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => { navProgress.done(); }, [pathname, search]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page / hash only
      navProgress.start();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return <div className={`${styles.bar} ${active ? styles.on : ""}`} role="progressbar" aria-label="Loading page" aria-hidden={!active} />;
}
