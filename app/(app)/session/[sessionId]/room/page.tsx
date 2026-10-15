import { Suspense } from "react";
import { Room } from "@/features/practice/Room";

export const metadata = { title: "Practice room" };
export default function Page() { return <Suspense><Room /></Suspense>; }
