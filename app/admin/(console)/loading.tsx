import { LoadingShell } from "@/components/app/Loading";

// Shown immediately while the next page's code loads (first visit to a route, slow network): the click is acknowledged at once.
// It is the neutral guard shell: never any protected content.
export default function Loading() { return <LoadingShell label="Loading page" />; }
