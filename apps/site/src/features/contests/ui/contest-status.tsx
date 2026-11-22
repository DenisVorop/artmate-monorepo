import { contestStagePresentation, contestStatusClassName } from "@repo/ui/contest-design";
import { Badge } from "@/shared/ui";
import { cn } from "@/shared/lib";
import type { ContestStage } from "../lib/types";
export function ContestStatus({ stage }: { stage: ContestStage }) {
  const presentation = contestStagePresentation[stage];
  return (
    <Badge className={cn(contestStatusClassName, presentation.className)}>
      {presentation.label}
    </Badge>
  );
}
