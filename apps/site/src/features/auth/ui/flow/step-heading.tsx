import type { ReactNode } from "react";

export function StepHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      tabIndex={-1}
      className="font-heading text-[25px] leading-[1.45] font-semibold tracking-[-0.6px] wrap-anywhere text-stone-900 outline-none sm:text-[28px] sm:tracking-[-0.8px]"
    >
      {children}
    </h2>
  );
}
