import { Suspense } from "react";
import { AcceptTerms } from "@/features/policy/Terms";

export const metadata = { title: "Terms and Privacy Policy" };
export default function Page() { return <Suspense><AcceptTerms /></Suspense>; }
