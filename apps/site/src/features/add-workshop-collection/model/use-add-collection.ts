"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ownerWorkshopCollectionSchema, workshopQuery } from "@/entities/workshop";
import { addMyWorkshopCollection } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useAddCollection() {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (collectionSlug: string) =>
      ownerWorkshopCollectionSchema.parse(
        ApiResult.fromDTO(await addMyWorkshopCollection({ collectionSlug })).unwrap(),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey });
    },
  });

  return { mutate, isPending };
}
