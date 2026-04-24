"use client";

import { useQuery } from "@tanstack/react-query";

import { reviewsQuery } from "./query";

export function useReviewsData() {
  const { data, isError } = useQuery(reviewsQuery.getData());

  return { data, isError };
}
