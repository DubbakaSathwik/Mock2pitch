"use client";
import { useEffect, useRef, useState } from "react";
import { toAppError, type AppError } from "@/lib/data/errors";
import { watchRow, type WatchOptions } from "./watch";

/** React wrapper around watchRow: re-subscribes when `key` changes, unsubscribes on unmount. */
export function useWatch<T>(key: string | null, make: () => Pick<WatchOptions<T>, "subscribe" | "fetch" | "isDone">): { value: T | null; error: AppError | null } {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const makeRef = useRef(make);
  makeRef.current = make;
  useEffect(() => {
    if (!key) return;
    setValue(null); setError(null);
    const stop = watchRow<T>({ ...makeRef.current(), onValue: (v) => { setError(null); setValue(v); }, onError: (e) => setError(toAppError(e)) });
    return stop;
  }, [key]);
  return { value, error };
}
