"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workshopQuery } from "@/entities/workshop";
import { deleteMyWorkshopWork } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useDeleteWorkshopWork(options: { onSuccess?: () => void } = {}) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (workId: string) =>
      ApiResult.fromDTO(await deleteMyWorkshopWork(workId)).unwrap(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workshopQuery.baseKey });
      options.onSuccess?.();
    },
  });

  return { mutate, isPending };
}
