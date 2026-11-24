"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { contestsQueryKeys } from "@/entities/contest";
import { bindContestPrizeProduct } from "@/shared/actions/contests";

export function useBindContestPrizeProduct(id: string) {
  const cache = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: ({ place, productId }: { place: number; productId: string }) =>
      bindContestPrizeProduct(id, place, productId),
    meta: {
      successMessage: "Товар привязан к призу",
      errorMessage: "Не удалось привязать товар",
    },
    onSuccess: (contest) => {
      cache.setQueryData(contestsQueryKeys.detail(contest.id), contest);
      void cache.invalidateQueries({ queryKey: contestsQueryKeys.list() });
    },
  });
  return { mutate, isPending };
}
