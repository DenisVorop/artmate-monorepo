"use client";
import { useMutation } from "@tanstack/react-query";
import { prepareContestEntryConsent } from "@/shared/actions/contests";
import { ApiResult } from "@/shared/lib/api-result";
export function usePrepareEntryConsent(slug: string) {
  const { mutate, data, error, isPending, reset } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await prepareContestEntryConsent(slug)).unwrap()!,
  });
  return { prepare: mutate, offer: data, error, isPending, reset };
}
