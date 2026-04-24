import { queryOptions } from "@tanstack/react-query";

import { getReviewsData } from "@/shared/actions/reviews";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import { emptyReviewsData, type ReviewsData } from "@/entities/reviews/model";

export type ReviewsDataResult = ApiResultDTO<ReviewsData>;

const baseKey = "reviews";

const initialData: ReviewsDataResult = {
  status: "empty",
  data: emptyReviewsData,
  isSuccess: false,
  isEmpty: true,
  isError: false,
};

export const reviewsQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: () => getReviewsData(),
      initialData,
      staleTime: Infinity,
    }),
};
