import { AdminGate } from "@/components/app/Gate";

export default function Layout({ children }: { children: React.ReactNode }) { return <AdminGate>{children}</AdminGate>; }
