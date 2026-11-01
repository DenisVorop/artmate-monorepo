"use client";

import { useRef, useState } from "react";
import type { GalleryWorksFilters } from "@/entities/community-work";
import { useQueryState } from "@/shared/lib/query-state-manager";
import { getGalleryParams, readGalleryFilters } from "./gallery-state";

export function useGalleryFilterState(initialCollectionSlug?: string) {
  const [params, { addMany }] = useQueryState();
  const signature = JSON.stringify([params.album, params.picture, initialCollectionSlug]);
  const [pending, setPending] = useState<{
    signature: string;
    filters: GalleryWorksFilters;
  } | null>(null);
  const filters =
    pending?.signature === signature
      ? pending.filters
      : readGalleryFilters(params, initialCollectionSlug);
  const currentFilters = useRef(filters);
  currentFilters.current = filters;

  const updateFilters = (
    update: GalleryWorksFilters | ((_current: GalleryWorksFilters) => GalleryWorksFilters),
  ) => {
    const next = typeof update === "function" ? update(currentFilters.current) : update;
    currentFilters.current = next;
    setPending({ signature, filters: next });
    addMany(getGalleryParams(next), { shallow: true });
  };

  return { filters, updateFilters, clearFilters: () => updateFilters({ collections: [] }) };
}
