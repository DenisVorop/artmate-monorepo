import { queryOptions } from "@tanstack/react-query";
import { getMyContestEntry, getMyContestPhoto } from "@/shared/actions/contests";
import { ApiResult } from "@/shared/lib/api-result";
export const contestEntryQuery = {
  mine: (slug: string, userId?: string) =>
    queryOptions({
      queryKey: ["my-contest-entry", userId, slug],
      queryFn: async () => ApiResult.fromDTO(await getMyContestEntry(slug)).unwrap() ?? null,
      enabled: Boolean(userId),
      staleTime: 0,
      retryOnMount: false,
      refetchInterval: 30_000,
    }),
  photo: (userId: string | undefined, id?: string, revisionId?: string) =>
    queryOptions({
      queryKey: ["my-contest-photo", userId, id, revisionId],
      queryFn: async () => ApiResult.fromDTO(await getMyContestPhoto(id!, revisionId!)).unwrap()!,
      enabled: Boolean(userId && id && revisionId),
      staleTime: Infinity,
      retryOnMount: false,
      gcTime: 0,
    }),
};
