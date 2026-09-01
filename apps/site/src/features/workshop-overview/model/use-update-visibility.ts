"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ownerWorkshopSchema, workshopQuery } from "@/entities/workshop";
import {
  updateMyWorkshopVisibility,
  type UpdateWorkshopVisibilityInput,
} from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useUpdateWorkshopVisibility(options: { onSuccess?: () => void } = {}) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: UpdateWorkshopVisibilityInput) =>
      ownerWorkshopSchema.parse(
        ApiResult.fromDTO(await updateMyWorkshopVisibility(input)).unwrap(),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey });
      options.onSuccess?.();
    },
  });

  return { mutate, isPending };
}
