import { Suspense } from "react";
import { SignIn } from "@/features/auth/SignIn";

export const metadata = { title: "Owner sign in" };
export default function Page() { return <Suspense><SignIn owner /></Suspense>; }
