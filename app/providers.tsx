"use client";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query";
import { ToastProvider, useToast } from "@/components/ds/Toast";
import { CompactProvider } from "@/components/app/Compact";
import { consumeFlash } from "@/lib/flash";

// Dev-only: the dead branch (and the import) is removed from production bundles because NODE_ENV is inlined at build time.
const MockPanel: ComponentType | null = process.env.NODE_ENV !== "production"
  ? dynamic(() => import("@/components/dev/MockPanel").then((m) => m.MockPanel), { ssr: false })
  : null;

function FlashToast() {
  const { toast } = useToast();
  useEffect(() => { const m = consumeFlash(); if (m) toast(m); }, [toast]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <CompactProvider>
        <ToastProvider>
          {children}
          <FlashToast />
          {MockPanel && <MockPanel />}
        </ToastProvider>
      </CompactProvider>
    </QueryClientProvider>
  );
}
