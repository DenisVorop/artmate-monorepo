"use client";

import { useQuery } from "@tanstack/react-query";
import { communityWorkQuery } from "./query";

export function useGalleryFilters() {
  const { data, isPending, isError, refetch } = useQuery(communityWorkQuery.galleryFilters());
  return { data, isPending, isError, refetch };
}
