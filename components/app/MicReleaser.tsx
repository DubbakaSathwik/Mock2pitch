"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordingStore } from "@/features/recording/store";

/**
 * The microphone and the recordings live inside /session/* and, for playback, on the report page that follows (/reports/*).
 * Leaving /session/* always releases the microphone; leaving both areas also revokes every clip URL. The report page clears its own
 * session's clips when it unmounts (see Report.tsx), so recordings never outlive that screen.
 */
export function MicReleaser() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/session/")) return;
    if (pathname.startsWith("/reports/")) { recordingStore.closeMic(); return; }
    recordingStore.reset();
  }, [pathname]);
  return null;
}
