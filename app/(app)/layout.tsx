import { StudentGate } from "@/components/app/Gate";
import { MicReleaser } from "@/components/app/MicReleaser";

// Every student route (dashboard, practice flow, sessions, reports, history, settings) is guarded once, here.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <StudentGate><MicReleaser />{children}</StudentGate>;
}
