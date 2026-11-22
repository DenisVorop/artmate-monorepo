"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  contestDrawQuery,
  type ManualContestDrawInput,
} from "@/entities/contest-draw";
import { contestsQueryKeys } from "@/entities/contest";
import { selectContestWinners } from "@/shared/actions/contests";
export function useSelectWinners(id: string) {
  const cache = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: (input: ManualContestDrawInput) =>
      selectContestWinners(id, input),
    onSuccess: (data) => {
      cache.setQueryData(contestDrawQuery.detail(id).queryKey, data);
      void cache.invalidateQueries({ queryKey: contestsQueryKeys.all });
    },
  });
  return { mutate, isPending };
}
