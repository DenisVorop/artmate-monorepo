"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  contestEntriesQuery,
  type ContestEntryDecision,
} from "@/entities/contest-entry";
import { contestsQueryKeys } from "@/entities/contest";
import { decideContestEntry } from "@/shared/actions/contest-entries";
export function useDecideContestEntry(id: string) {
  const client = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: (input: ContestEntryDecision) => decideContestEntry(id, input),
    onSuccess: (entry) => {
      client.setQueryData(contestEntriesQuery.detail(id).queryKey, entry);
      void client.invalidateQueries({
        queryKey: [...contestEntriesQuery.baseKey, "list"],
      });
      void client.invalidateQueries({ queryKey: contestsQueryKeys.all });
    },
  });
  return { mutate, isPending };
}
