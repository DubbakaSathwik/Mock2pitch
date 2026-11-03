"use client";
import { useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { navProgress } from "./nav-progress";

/**
 * Navigate with feedback. `pending` is true from the click until the next page has rendered, so a button can show a spinner
 * (`<Button loading={pending}>`) and the top progress bar runs. Without it, a slow first compile or a slow network leaves the
 * old page looking frozen.
 */
export function useGo() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const go = useCallback((href: string, o: { replace?: boolean } = {}) => {
    navProgress.start();
    startTransition(() => { if (o.replace) router.replace(href); else router.push(href); });
  }, [router]);
  return { go, pending };
}
