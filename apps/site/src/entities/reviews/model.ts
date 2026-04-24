import type { ReviewsData } from "@/shared/actions/reviews";

export type { Review, ReviewsData, ReviewStats } from "@/shared/actions/reviews";

export const emptyReviewsData: ReviewsData = {
  reviews: [],
  stats: {
    rating: 0,
    ratingLabel: "",
    reviewsLabel: "",
  },
};
