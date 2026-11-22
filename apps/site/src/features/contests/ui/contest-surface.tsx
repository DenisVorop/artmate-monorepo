import type { ReactNode } from "react";
import {
  ContestSurface as SharedContestSurface,
  type ContestAppearance,
} from "@repo/ui/contest-design";
import { Card } from "@/shared/ui";
export function ContestSurface(props: {
  appearance: ContestAppearance;
  className?: string;
  children: ReactNode;
}) {
  return <SharedContestSurface card={Card} {...props} />;
}
