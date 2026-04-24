import { queryOptions } from "@tanstack/react-query";

import { getReviewsData } from "@/shared/actions/reviews";
import { ensureApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type { ReviewsData } from "./types";

export type ReviewsDataResult = ApiResultDTO<ReviewsData>;

const baseKey = "reviews";

export const reviewsQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ensureApiResult(await getReviewsData()),
      staleTime: Infinity,
    }),
};
