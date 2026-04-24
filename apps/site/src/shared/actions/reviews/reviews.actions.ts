'use server';

import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { reviewsData, type ReviewsData } from "./reviews.data";

export async function getReviewsData(): Promise<ApiResultDTO<ReviewsData>> {
  const result = await ApiResult.prepareApi(async () => reviewsData, {
    isEmptyCb: (data) => data.reviews.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<ReviewsData>;
}
