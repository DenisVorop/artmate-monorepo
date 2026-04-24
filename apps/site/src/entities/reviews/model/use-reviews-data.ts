"use client";

import { useQuery } from "@tanstack/react-query";

import { emptyReviewsData } from "@/entities/reviews/model";

import { reviewsQuery } from "./query";

export function useReviewsData() {
  const { data } = useQuery(reviewsQuery.getData());
  const reviewsData = data?.data ?? emptyReviewsData;

  return {
    reviews: reviewsData.reviews,
    stats: reviewsData.stats,
    isError: data?.isError === true,
    isEmpty: data?.isEmpty === true,
  };
}
