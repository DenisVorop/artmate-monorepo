import type { WorkshopModerationStatus } from "../model";
import {
  getWorkshopModerationStatusBadgeVariant,
  getWorkshopModerationStatusLabel,
} from "../lib";
import { Badge } from "@/shared/ui";

export function WorkshopModerationStatusBadge({
  status,
}: {
  readonly status: WorkshopModerationStatus;
}) {
  return (
    <Badge variant={getWorkshopModerationStatusBadgeVariant(status)}>
      {getWorkshopModerationStatusLabel(status)}
    </Badge>
  );
}
