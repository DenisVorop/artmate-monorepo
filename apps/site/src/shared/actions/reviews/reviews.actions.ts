'use server';

import { reviewsData } from "@/entities/reviews/model";
import type { ReviewsData } from "@/entities/reviews/model";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

export async function getReviewsData(): Promise<ApiResultDTO<ReviewsData>> {
  const result = await ApiResult.prepareApi(async () => reviewsData, {
    isEmptyCb: (data) => data.reviews.length === 0,
  })();

  return result.toDTO() as ApiResultDTO<ReviewsData>;
}
