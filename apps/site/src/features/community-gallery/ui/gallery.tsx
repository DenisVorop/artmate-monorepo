"use client";

import { useGalleryFilters } from "@/entities/community-work";
import { Button } from "@/shared/ui";

import { useGalleryFilterState } from "../lib/use-gallery-filter-state";
import { Filters } from "./filters";
import { GalleryWorks } from "./works";

export function CommunityGallery({ initialCollectionSlug }: { initialCollectionSlug?: string }) {
  const { data, isError, refetch } = useGalleryFilters();
  const { filters, updateFilters, clearFilters } = useGalleryFilterState(initialCollectionSlug);
  return (
    <div className="space-y-5 md:space-y-6">
      {data && (
        <Filters options={data} filters={filters} onChange={updateFilters} onReset={clearFilters} />
      )}
      {isError && (
        <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
          <p>Не удалось загрузить фильтры.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Повторить
          </Button>
        </div>
      )}
      <GalleryWorks key={JSON.stringify(filters)} filters={filters} onReset={clearFilters} />
    </div>
  );
}
