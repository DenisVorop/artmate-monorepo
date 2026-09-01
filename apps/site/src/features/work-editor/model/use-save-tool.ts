"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { workshopQuery, workshopToolSchema } from "@/entities/workshop";
import { saveMyWorkshopTool, type SaveWorkshopToolInput } from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

export function useSaveWorkshopTool() {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: SaveWorkshopToolInput) =>
      workshopToolSchema.parse(ApiResult.fromDTO(await saveMyWorkshopTool(input)).unwrap()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workshopQuery.tools().queryKey });
    },
  });

  return { mutate, isPending };
}
