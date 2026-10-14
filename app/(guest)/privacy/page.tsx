import { Suspense } from "react";
import { PolicyView } from "@/features/policy/Terms";

export const metadata = { title: "Privacy Policy" };
export default function Page() { return <Suspense><PolicyView initial="privacy" /></Suspense>; }
