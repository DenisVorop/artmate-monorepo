import type { ReactNode } from "react";

export function StepHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      tabIndex={-1}
      className="font-heading text-[28px] leading-[1.45] font-semibold tracking-[-0.8px] text-stone-900 outline-none"
    >
      {children}
    </h2>
  );
}
