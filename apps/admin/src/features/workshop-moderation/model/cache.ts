import type { QueryClient } from "@tanstack/react-query";

import {
  workshopModerationQueryKeys,
  type WorkshopModerationDetail,
} from "@/entities/workshop-moderation";

export async function updateWorkshopModerationCache(
  queryClient: QueryClient,
  detail: WorkshopModerationDetail,
) {
  queryClient.setQueryData(
    workshopModerationQueryKeys.detail(detail.revisionId),
    detail,
  );
  await queryClient.invalidateQueries({
    queryKey: workshopModerationQueryKeys.queues(),
  });
}
