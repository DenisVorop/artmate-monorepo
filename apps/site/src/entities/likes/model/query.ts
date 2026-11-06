import { queryOptions } from "@tanstack/react-query";
import { getLikes, type LikeSubject } from "@/shared/actions/likes";
import { ApiResult } from "@/shared/lib/api-result";
import { likesQueryKey } from "@/shared/lib/query-keys";
import { createLikesBatchReader } from "../lib/batch-reader";
import { likesBatchSchema } from "./schemas";

const read = createLikesBatchReader(
  async (subjects, owner) =>
    likesBatchSchema.parse(ApiResult.fromDTO(await getLikes(subjects, owner)).unwrap()).items,
);

export const likesQuery = {
  baseKey: likesQueryKey,
  state: (subject: LikeSubject, owner: string) =>
    queryOptions({
      queryKey: [...likesQueryKey, owner, subject.subjectType, subject.subjectId] as const,
      queryFn: () => read(subject, owner),
      staleTime: 30_000,
      retry: false,
      retryOnMount: false,
    }),
};
