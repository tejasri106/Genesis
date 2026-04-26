"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AppStoreProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AppStoreProvider>
      <AppShell>{children}</AppShell>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          duration: 6000,
          classNames: {
            error: "border-destructive/40 bg-destructive/10 text-destructive",
            warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
          },
        }}
      />
    </AppStoreProvider>
  );
}
