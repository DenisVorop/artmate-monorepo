import type { z } from "zod";

import type {
  communityWorkSummarySchema,
  galleryWorksPageSchema,
  galleryFiltersSchema,
  publicCommunityWorkSchema,
  publicWorkshopSchema,
  galleryWorkSchema,
  contestGalleryWorkSchema,
} from "./schemas";

export type CommunityWorkSummary = z.infer<typeof communityWorkSummarySchema>;
export type PublicCommunityWork = z.infer<typeof publicCommunityWorkSchema>;
export type PublicWorkshop = z.infer<typeof publicWorkshopSchema>;
export type GalleryWorksPage = z.infer<typeof galleryWorksPageSchema>;
export type GalleryWork = z.infer<typeof galleryWorkSchema>;
export type ContestGalleryWork = z.infer<typeof contestGalleryWorkSchema>;
export type GalleryFilters = z.infer<typeof galleryFiltersSchema>;
export type GalleryWorksFilters = { collections?: string[]; number?: number };
