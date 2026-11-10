"use client";

import { useAnalytics } from "../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { communityWorkQuery } from "@/entities/community-work";
import { workshopQuery, workshopWorkSchema } from "@/entities/workshop";
import { publishMyWorkshopWork } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function usePublishWorkshopWork(options: { onSuccess?: () => void } = {}) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (workId: string) =>
      workshopWorkSchema.parse(ApiResult.fromDTO(await publishMyWorkshopWork(workId)).unwrap()),
    onError: () => analytics.publishFailed(),
    onSuccess: async () => {
      analytics.published();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey }),
        queryClient.invalidateQueries({ queryKey: communityWorkQuery.baseKey }),
      ]);
      options.onSuccess?.();
    },
  });

  return { mutate, isPending };
}
