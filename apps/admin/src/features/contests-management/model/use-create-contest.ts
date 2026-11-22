"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContest } from "@/shared/actions/contests";
import { contestsQueryKeys, type Contest } from "@/entities/contest";
export function useCreateContest(onSuccess: (contest: Contest) => void) {
  const cache = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: createContest,
    meta: {
      successMessage: "Конкурс создан",
      errorMessage: "Не удалось создать конкурс",
    },
    onSuccess: (contest) => {
      cache.setQueryData(contestsQueryKeys.detail(contest.id), contest);
      void cache.invalidateQueries({ queryKey: contestsQueryKeys.list() });
      onSuccess(contest);
    },
  });
  return { mutate, isPending };
}
