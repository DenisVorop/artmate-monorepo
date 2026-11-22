"use client";
import { useQuery } from "@tanstack/react-query";
import { contestEntryQuery } from "./entry-query";
export function useMyContestEntry(slug: string, userId?: string) {
  const { data, isPending, isError, refetch } = useQuery(contestEntryQuery.mine(slug, userId));
  return { entry: data, isPending: Boolean(userId) && isPending, isError, refetch };
}
export function useMyContestPhoto(userId?: string, id?: string, revisionId?: string) {
  const { data, isPending, isError, refetch } = useQuery(
    contestEntryQuery.photo(userId, id, revisionId),
  );
  return { photoUrl: data, isPending, isError, refetch };
}
