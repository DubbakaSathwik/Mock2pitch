"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import styles from "./Toast.module.css";

type ToastTone = "success" | "info" | "warning" | "danger";
type ToastState = { id: number; message: string; tone: ToastTone } | null;
type ToastApi = { toast: (message: string, tone?: ToastTone) => void };

const Ctx = createContext<ToastApi>({ toast: () => {} });
export const useToast = () => useContext(Ctx);
export const TOAST_MS = 2600;

const ICON = { success: "circle-check", info: "info", warning: "triangle-alert", danger: "circle-x" } as const;
const COLOR = { success: "#9CF0CB", info: "var(--icy-blue)", warning: "#F5C26B", danger: "#FFB4B4" } as const;

/** Bottom-centre Prussian pill, 2.6 s, announced politely. One toast at a time (a new one replaces the old). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastState>(null);
  const [mounted, setMounted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  useEffect(() => setMounted(true), []);
  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    if (timer.current) clearTimeout(timer.current);
    const id = ++seq.current;
    setT({ id, message, tone });
    timer.current = setTimeout(() => setT((cur) => (cur?.id === id ? null : cur)), TOAST_MS);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {mounted && createPortal(
        <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
          {t && <div key={t.id} className={styles.toast}><Icon name={ICON[t.tone]} size={16} color={COLOR[t.tone]} />{t.message}</div>}
        </div>,
        document.body,
      )}
    </Ctx.Provider>
  );
}
