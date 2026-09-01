import type { ReactNode } from "react";

import { cn } from "@/shared/lib";
import { Badge } from "@/shared/ui";
import { SectionSubtitle, SectionTitle } from "@/shared/ui/typography";

type SectionHeadingProps = {
  align?: "left" | "center";
  description: string;
  eyebrow: string;
  id?: string;
  title: ReactNode;
};

export function SectionHeading({
  align = "left",
  description,
  eyebrow,
  id,
  title,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
      )}
    >
      <Badge
        variant="outline"
        className="w-fit rounded-full border-rose-200 bg-white/70 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-rose-600 uppercase shadow-sm backdrop-blur-sm"
      >
        {eyebrow}
      </Badge>
      <SectionTitle id={id} className="max-w-3xl text-balance md:!text-[2.5rem]">
        {title}
      </SectionTitle>
      <SectionSubtitle className="max-w-2xl text-pretty text-stone-600 md:text-lg md:leading-8">
        {description}
      </SectionSubtitle>
    </div>
  );
}
