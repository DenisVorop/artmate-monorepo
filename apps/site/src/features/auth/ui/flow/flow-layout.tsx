import type { ReactNode } from "react";

import { BenefitsPanel } from "./benefits-panel";

export const flowGridClassName =
  "grid gap-6 px-5 pt-5 pb-6 sm:grid-cols-2 sm:gap-x-7 sm:px-8 sm:pb-8";
export const fieldStackClassName = "space-y-5 [&>[data-auth-field]:not(:last-child)]:mb-2";
export const stepFormClassName = "flex min-h-76 min-w-0 flex-col gap-5 sm:min-h-87";
export const fieldInputClassName = "h-12 bg-white px-3 text-base md:text-base";
export const primaryButtonClassName =
  "h-auto min-h-12 w-full rounded-[10px] px-4 py-3 text-[15px] text-stone-950 whitespace-normal";

export function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <div className={flowGridClassName}>
      <div className="min-w-0 pt-2">{children}</div>
      <BenefitsPanel />
    </div>
  );
}
