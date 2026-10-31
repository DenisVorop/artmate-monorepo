import type { GalleryWorksFilters } from "@/entities/community-work";
import type { SearchParams } from "@/shared/lib/query-state-manager";

export function readGalleryFilters(
  params: SearchParams,
  initialCollectionSlug?: string,
): GalleryWorksFilters {
  const albums = params.album;
  const values =
    albums === undefined
      ? initialCollectionSlug
        ? [initialCollectionSlug]
        : []
      : Array.isArray(albums)
        ? albums
        : [albums];
  const collections = values.includes("all")
    ? []
    : [...new Set(values.filter((value) => /^[a-z0-9-]{1,120}$/.test(value)))].sort().slice(0, 30);
  const picture = params.picture;
  const number =
    typeof picture === "string" && /^(?:[1-9]|[1-9][0-9])$/.test(picture)
      ? Number(picture)
      : undefined;
  return { collections, number };
}

export function getGalleryParams(filters: GalleryWorksFilters) {
  return {
    album: filters.collections?.length ? [...filters.collections].sort() : ["all"],
    picture: filters.number === undefined ? "all" : String(filters.number),
  };
}
