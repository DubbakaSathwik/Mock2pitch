import { Suspense } from "react";
import { SignIn } from "@/features/auth/SignIn";

export const metadata = { title: "Sign in" };
export default function Page() { return <Suspense><SignIn /></Suspense>; }
