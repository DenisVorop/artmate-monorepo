"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  dismissToast,
  getToastSnapshot,
  subscribeToasts,
  type ToastItem,
} from "@/shared/lib/toast-store";

export function Toaster() {
  const toasts = useSyncExternalStore(
    subscribeToasts,
    getToastSnapshot,
    getToastSnapshot,
  );

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      aria-relevant="additions text"
      className="fixed top-4 right-4 z-50 grid w-[min(24rem,calc(100vw-2rem))] gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { readonly toast: ToastItem }) {
  const Icon = toast.variant === "error" ? CircleAlert : CheckCircle2;

  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-background p-3 text-sm shadow-lg",
        toast.variant === "error"
          ? "border-destructive/30"
          : "border-emerald-200 dark:border-emerald-900/70",
      )}
      role={toast.variant === "error" ? "alert" : "status"}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-4",
          toast.variant === "error" ? "text-destructive" : "text-emerald-600",
        )}
      />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-muted-foreground">{toast.description}</p>
        ) : null}
      </div>
      <button
        aria-label="Закрыть уведомление"
        className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => dismissToast(toast.id)}
        type="button"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
