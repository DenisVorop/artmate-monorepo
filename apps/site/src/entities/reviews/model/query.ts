import { queryOptions } from "@tanstack/react-query";

import { getReviewsData } from "@/shared/actions/reviews";
import { ApiResult } from "@/shared/lib/api-result";

import type { ReviewsData } from "./types";

export type ReviewsDataResult = ReviewsData | null;

const baseKey = "reviews";

export const reviewsQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ApiResult.fromDTO(await getReviewsData()).unwrap() ?? null,
      staleTime: Infinity,
    }),
};
