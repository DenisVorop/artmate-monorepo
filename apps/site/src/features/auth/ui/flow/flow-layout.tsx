import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

import { BenefitsPanel } from "./benefits-panel";

export const flowGridClassName =
  "grid gap-6 px-5 pt-5 pb-6 sm:grid-cols-2 sm:gap-x-7 sm:px-8 sm:pb-8";
export const fieldStackClassName = "space-y-5 [&>[data-auth-field]:not(:last-child)]:mb-2";
export const fieldInputClassName = "h-12 bg-white px-3 text-base md:text-base";
export const primaryButtonClassName =
  "h-auto min-h-12 w-full rounded-[10px] px-4 py-3 text-[15px] text-white whitespace-normal";

export function FlowLayout({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div
      className={cn(
        flowGridClassName,
        "min-h-76 sm:min-h-87",
        actions && "sm:grid-rows-[1fr_auto]",
      )}
    >
      <div className="min-w-0 space-y-5 pt-2">{children}</div>
      <BenefitsPanel
        className={actions ? "sm:col-start-2 sm:row-span-2 sm:row-start-1" : undefined}
      />
      {actions && (
        <div className="min-w-0 sm:col-start-1 sm:row-start-2 sm:self-end">{actions}</div>
      )}
    </div>
  );
}
