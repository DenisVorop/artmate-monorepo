"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { contestEntryQuery } from "@/entities/contest";
import { submitContestEntry, type SubmitContestEntryInput } from "@/shared/actions/contests";
import { ApiResult } from "@/shared/lib/api-result";
import { useAnalytics } from "../lib/analytics";
export function useSubmitContestEntry(
  slug: string,
  userId: string | undefined,
  onSuccess: () => void,
) {
  const client = useQueryClient();
  const analytics = useAnalytics();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: SubmitContestEntryInput) =>
      ApiResult.fromDTO(await submitContestEntry(slug, input)).unwrap()!,
    onSuccess: (entry, input) => {
      client.setQueryData(contestEntryQuery.mine(slug, userId).queryKey, entry);
      if (input.version === undefined && entry?.version === 1) {
        analytics.entrySubmitted(slug, entry.publicId);
      }
      onSuccess();
    },
  });
  return { mutate, isPending };
}
