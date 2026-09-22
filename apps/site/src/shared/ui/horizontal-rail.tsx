/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- Native scrolling regions need keyboard focus for arrow-key scrolling. */
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Native touch/trackpad scrolling; keyboard focus brings cards into view. */
export function HorizontalRail({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "grid min-w-0 snap-x snap-proximity [scrollbar-width:thin] [scrollbar-color:var(--color-stone-300)_transparent] auto-cols-[min(72vw,15rem)] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain rounded-2xl px-1 pt-1 pb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 [&>*]:min-w-0 [&>*]:snap-start",
        "max-md:relative max-md:left-1/2 max-md:-ml-[50vw] max-md:w-screen max-md:scroll-px-4 max-md:rounded-none max-md:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
