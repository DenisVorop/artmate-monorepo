"use client";

import { useQuery } from "@tanstack/react-query";
import { communityWorkQuery } from "./query";

export function useFeaturedCollectionWorks(slugs: readonly string[]) {
  const { data, isError, isPending } = useQuery(communityWorkQuery.featuredForCollections(slugs));
  return { works: data ?? [], isError, isPending };
}
