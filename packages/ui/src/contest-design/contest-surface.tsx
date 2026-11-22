import type { ComponentProps, ComponentType, ReactNode } from "react";
import { contestAppearances, type ContestAppearance } from "./appearance";
import { cn } from "./class-names";
import { ContestDecoration } from "./contest-decoration";

export type ContestCard = ComponentType<ComponentProps<"div">>;
export function ContestSurface({
  card: Card,
  appearance,
  className,
  children,
}: {
  card: ContestCard;
  appearance: ContestAppearance;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      data-contest-appearance={appearance}
      className={cn(
        "@container/contest relative isolate gap-0 overflow-hidden rounded-3xl py-0",
        contestAppearances[appearance].card,
        className,
      )}
    >
      {children}
      <ContestDecoration appearance={appearance} />
    </Card>
  );
}
