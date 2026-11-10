"use client";

import { useAnalytics } from "../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { communityWorkQuery } from "@/entities/community-work";
import { workshopQuery } from "@/entities/workshop";
import { deleteMyWorkshopWork } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useDeleteWorkshopWork(options: { onSuccess?: () => void } = {}) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (workId: string) =>
      ApiResult.fromDTO(await deleteMyWorkshopWork(workId)).unwrap(),
    onError: () => analytics.deleteFailed(),
    onSuccess: async () => {
      analytics.deleted();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey }),
        queryClient.invalidateQueries({ queryKey: communityWorkQuery.baseKey }),
      ]);
      options.onSuccess?.();
    },
  });

  return { mutate, isPending };
}
