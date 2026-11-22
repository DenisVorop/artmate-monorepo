"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateContest } from "@/shared/actions/contests";
import { contestsQueryKeys, type ContestInput } from "@/entities/contest";
export function useUpdateContest(id: string) {
  const cache = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: (input: ContestInput & { version: number }) =>
      updateContest(id, input),
    meta: {
      successMessage: "Изменения сохранены",
      errorMessage: "Не удалось сохранить конкурс",
    },
    onSuccess: (contest) => {
      cache.setQueryData(contestsQueryKeys.detail(contest.id), contest);
      void cache.invalidateQueries({ queryKey: contestsQueryKeys.list() });
    },
  });
  return { mutate, isPending };
}
