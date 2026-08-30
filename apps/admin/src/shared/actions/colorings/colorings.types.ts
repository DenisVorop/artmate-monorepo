import type { ProductStatusDTO } from "../products";

export const coloringStatuses = ["draft", "published", "archived"] as const;
export type ColoringStatusDTO = (typeof coloringStatuses)[number];

export const coloringCollectionStatuses = [
  "draft",
  "published",
  "archived",
] as const;
export type ColoringCollectionStatusDTO =
  (typeof coloringCollectionStatuses)[number];

export const coloringRevisionStatuses = [
  "review_required",
  "approved",
  "rejected",
  "published",
] as const;
export type ColoringRevisionStatusDTO =
  (typeof coloringRevisionStatuses)[number];

export type ColoringCollectionProductReferenceDTO = {
  id: string;
  slug: string;
  title: string;
};

export type ColoringCollectionProductDTO =
  ColoringCollectionProductReferenceDTO & {
    status: ProductStatusDTO;
  };

export type ColoringCollectionReferenceDTO = {
  id: string;
  slug: string;
  title: string;
  product: ColoringCollectionProductReferenceDTO;
};

export type ColoringCollectionCoverDTO = {
  url: string;
  alt: string;
  width: number;
  height: number;
};

export type ColoringCollectionDTO = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  description?: string;
  position: number;
  status: ColoringCollectionStatusDTO;
  expectedColoringCount: number;
  cover?: ColoringCollectionCoverDTO;
  coloringCount: number;
  publishedColoringCount: number;
  product: ColoringCollectionProductDTO;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type ColoringThemeDTO = {
  id: string;
  slug: string;
  title: string;
};

export type ColoringDTO = {
  id: string;
  collectionId: string;
  number: number;
  title: string;
  description?: string;
  position: number;
  status: ColoringStatusDTO;
  publishedRevisionId?: string;
  publishedAt?: string;
  collection: ColoringCollectionReferenceDTO;
  themes: ColoringThemeDTO[];
  createdAt: string;
  updatedAt: string;
};

export type ColoringRevisionAssetDTO = {
  sourceMime: "image/png" | "image/webp";
  sourceChecksum: string;
  mimeType: "image/webp";
  byteSize: number;
  checksum: string;
  alt: string;
  previewUrl: string;
  publicUrl?: string;
};

export type ColoringRevisionReviewDTO = {
  decision: "approved" | "rejected";
  comment?: string;
  reviewedById?: string;
  reviewedAt: string;
};

export type MarkerColorDTO = {
  id: string;
  colorNumber: number;
  pantone: string;
  hex: string;
  catalogPosition: number;
  markerNumber: string;
};

export type ColoringRevisionPaletteColorDTO = {
  symbol: string;
  symbolPosition: number;
  markerColorId: string;
  colorNumber: number;
  pantone: string;
  hex: string;
  markerNumber: string;
};

export type ColoringRevisionDTO = {
  id: string;
  coloringId: string;
  version: number;
  status: ColoringRevisionStatusDTO;
  paletteLabel: string;
  paletteVersion: string;
  usedColorCount: number;
  paletteColors: ColoringRevisionPaletteColorDTO[];
  width: number;
  height: number;
  derivativeProfile: "webp-preview-v1" | "webp-preview-v2" | "webp-preview-v3";
  colorSpace: "srgb";
  outline: ColoringRevisionAssetDTO;
  colored: ColoringRevisionAssetDTO;
  review?: ColoringRevisionReviewDTO;
  createdById?: string;
  createdAt: string;
};

export type CreateColoringCollectionInputDTO = {
  productId: string;
  slug: string;
  title: string;
  description?: string;
  position: number;
  expectedColoringCount: number;
};

export type UpdateColoringCollectionInputDTO = Partial<{
  slug: string;
  title: string;
  description: string | null;
  position: number;
  expectedColoringCount: number;
}> & {
  updatedAt: string;
};

export type CreateColoringInputDTO = {
  collectionId: string;
  title: string;
  description?: string | null;
  position: number;
  themeTagIds?: string[];
};

export type UpdateColoringInputDTO = Partial<
  CreateColoringInputDTO & { number: number }
> & { updatedAt: string };

export type ReviewColoringRevisionInputDTO = {
  decision: "approved" | "rejected";
  comment?: string;
};
