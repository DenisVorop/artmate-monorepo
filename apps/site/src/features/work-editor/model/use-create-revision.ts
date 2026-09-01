"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workshopQuery, workshopWorkSchema } from "@/entities/workshop";
import {
  createMyWorkshopRevision,
  type CreateWorkshopRevisionInput,
} from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useCreateWorkshopRevision(
  slug: string,
  number: number,
  options: { onSuccess?: () => void } = {},
) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: CreateWorkshopRevisionInput) =>
      workshopWorkSchema.parse(
        ApiResult.fromDTO(await createMyWorkshopRevision(slug, number, input)).unwrap(),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey });
      options.onSuccess?.();
    },
  });

  return { mutate, isPending };
}
