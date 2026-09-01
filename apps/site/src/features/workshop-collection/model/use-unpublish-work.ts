"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workshopQuery, workshopWorkSchema } from "@/entities/workshop";
import { unpublishMyWorkshopWork } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useUnpublishWorkshopWork(options: { onSuccess?: () => void } = {}) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (workId: string) =>
      workshopWorkSchema.parse(ApiResult.fromDTO(await unpublishMyWorkshopWork(workId)).unwrap()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey });
      options.onSuccess?.();
    },
  });

  return { mutate, isPending };
}
