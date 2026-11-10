"use client";

import { useAnalytics } from "../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ownerWorkshopCollectionSchema, workshopQuery } from "@/entities/workshop";
import { addMyWorkshopCollection } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useAddWorkshopCollection(options: { onSuccess?: () => void } = {}) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (collectionSlug: string) =>
      ownerWorkshopCollectionSchema.parse(
        ApiResult.fromDTO(await addMyWorkshopCollection({ collectionSlug })).unwrap(),
      ),
    onError: () => analytics.addFailed(),
    onSuccess: async () => {
      analytics.collectionAdded();
      await queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey });
      options.onSuccess?.();
    },
  });

  return { mutate, isPending };
}
