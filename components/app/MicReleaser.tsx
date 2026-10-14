"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordingStore } from "@/features/recording/store";

/** Recordings and the microphone live only inside /session/*. Leaving that area releases the mic and revokes every clip URL. */
export function MicReleaser() {
  const pathname = usePathname();
  useEffect(() => { if (!pathname.startsWith("/session/")) recordingStore.reset(); }, [pathname]);
  return null;
}
