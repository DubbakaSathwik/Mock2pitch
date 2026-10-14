import { Suspense } from "react";
import { PolicyView } from "@/features/policy/Terms";

export const metadata = { title: "Terms" };
export default function Page() { return <Suspense><PolicyView initial="terms" /></Suspense>; }
