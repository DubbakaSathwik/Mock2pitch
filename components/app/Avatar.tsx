"use client";
import { useState } from "react";

export function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase() || "?";
}

/** Google photo when available, initials otherwise (also if the photo fails to load). */
export function Avatar({ name, src, size = 40, bg = "var(--imperial-blue)", fg = "#fff" }: { name: string; src?: string | null; size?: number; bg?: string; fg?: string }) {
  const [broken, setBroken] = useState(false);
  const base = { width: size, height: size, borderRadius: "50%", flexShrink: 0 } as const;
  if (src && !broken) {
    return <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} style={{ ...base, objectFit: "cover" }} />;
  }
  return <div aria-hidden="true" style={{ ...base, background: bg, color: fg, fontFamily: "var(--font-display)", fontSize: size * 0.38, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials(name)}</div>;
}
