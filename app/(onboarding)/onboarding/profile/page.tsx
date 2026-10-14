import { Suspense } from "react";
import { ProfileSetup } from "@/features/profile/ProfileSetup";

export const metadata = { title: "Your profile" };
export default function Page() { return <Suspense><ProfileSetup /></Suspense>; }
