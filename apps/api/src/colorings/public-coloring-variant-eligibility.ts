import { ColoringStatus, Prisma } from "../generated/prisma/client";
import { formatColoringNumber } from "./coloring-number";
import {
  coloringDerivativeMaxBytes,
  coloringDerivativeMaxSide,
  coloringDerivativeProfiles,
} from "./coloring-derivative-profile";
import { publicCollectionParentWhere } from "./public-coloring-eligibility";

export const publicOriginalReadinessWhere = {
  status: ColoringStatus.PUBLISHED,
  publishedAt: { not: null },
} satisfies Prisma.ColoringOriginalWhereInput;

export const publicOriginalSelect = {
  imageStorageKey: true,
  imageChecksum: true,
  imageByteSize: true,
  sourceChecksum: true,
  sourceMime: true,
  imageAlt: true,
  cardStorageKey: true,
  cardChecksum: true,
  cardByteSize: true,
  cardWidth: true,
  cardHeight: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  colors: {
    select: { symbolPosition: true, hex: true },
    orderBy: { symbolPosition: "asc" },
  },
} satisfies Prisma.ColoringOriginalSelect;

export const publicArtworkSelect = {
  width: true,
  height: true,
  derivativeProfile: true,
  colorSpace: true,
  outlineStorageKey: true,
  outlineChecksum: true,
  outlineByteSize: true,
  outlineSourceChecksum: true,
  outlineSourceMime: true,
  outlineAlt: true,
  updatedAt: true,
  original: { select: publicOriginalSelect },
} satisfies Prisma.ColoringArtworkSelect;

type PublicArtwork = Prisma.ColoringArtworkGetPayload<{
  select: typeof publicArtworkSelect;
}>;

export function isReadyPublishedArtwork<T extends PublicArtwork>(
  artwork: T | null | undefined,
): artwork is T & { original: NonNullable<T["original"]> } {
  return Boolean(
    artwork &&
    Number.isInteger(artwork.width) &&
    artwork.width > 0 &&
    artwork.width <= coloringDerivativeMaxSide &&
    Number.isInteger(artwork.height) &&
    artwork.height > 0 &&
    artwork.height <= coloringDerivativeMaxSide &&
    coloringDerivativeProfiles.some(
      (profile) => profile === artwork.derivativeProfile,
    ) &&
    artwork.colorSpace === "srgb" &&
    artwork.outlineStorageKey.trim() &&
    /^[a-f0-9]{64}$/.test(artwork.outlineChecksum) &&
    Number.isInteger(artwork.outlineByteSize) &&
    artwork.outlineByteSize > 0 &&
    artwork.outlineByteSize <= coloringDerivativeMaxBytes &&
    /^[a-f0-9]{64}$/.test(artwork.outlineSourceChecksum) &&
    artwork.outlineSourceMime.trim() &&
    artwork.outlineAlt.trim() &&
    isReadyPublishedOriginal(artwork.original),
  );
}

export function isCompleteOriginalPalette(
  colors: Array<{ symbolPosition: number; hex: string }>,
) {
  return (
    colors.length > 0 &&
    colors.length <= 19 &&
    new Set(colors.map((color) => color.symbolPosition)).size ===
      colors.length &&
    colors.every(
      (color) =>
        Number.isInteger(color.symbolPosition) &&
        color.symbolPosition >= 1 &&
        color.symbolPosition <= 19 &&
        /^#[0-9a-f]{6}$/i.test(color.hex),
    )
  );
}

function isReadyPublishedOriginal(
  original:
    | {
        status: ColoringStatus;
        publishedAt: Date | null;
        imageStorageKey: string;
        imageChecksum: string;
        imageByteSize: number;
        sourceChecksum: string;
        sourceMime: string;
        imageAlt: string;
        cardStorageKey: string;
        cardChecksum: string;
        cardByteSize: number;
        cardWidth: number;
        cardHeight: number;
        colors: Array<{ symbolPosition: number; hex: string }>;
      }
    | null
    | undefined,
): original is NonNullable<typeof original> {
  if (!original) return false;
  return (
    original.status === ColoringStatus.PUBLISHED &&
    original.publishedAt !== null &&
    Boolean(original.imageStorageKey.trim()) &&
    /^[a-f0-9]{64}$/.test(original.imageChecksum) &&
    Number.isInteger(original.imageByteSize) &&
    original.imageByteSize > 0 &&
    original.imageByteSize <= coloringDerivativeMaxBytes &&
    /^[a-f0-9]{64}$/.test(original.sourceChecksum) &&
    Boolean(original.sourceMime.trim()) &&
    Boolean(original.imageAlt.trim()) &&
    Boolean(original.cardStorageKey.trim()) &&
    /^[a-f0-9]{64}$/.test(original.cardChecksum) &&
    Number.isInteger(original.cardByteSize) &&
    original.cardByteSize > 0 &&
    original.cardByteSize <= coloringDerivativeMaxBytes &&
    Number.isInteger(original.cardWidth) &&
    original.cardWidth > 0 &&
    original.cardWidth <= 640 &&
    Number.isInteger(original.cardHeight) &&
    original.cardHeight > 0 &&
    original.cardHeight <= 640 &&
    isCompleteOriginalPalette(original.colors)
  );
}

export function publicOriginalAssetUrl(
  apiUrl: string,
  collectionSlug: string,
  number: number,
  kind: "colored" | "card",
  checksum: string,
) {
  return `${apiUrl.replace(/\/+$/, "")}/colorings/${encodeURIComponent(collectionSlug)}/${formatColoringNumber(number)}/variants/assets/original/${kind}/${checksum}/content`;
}

export const publicVariantColoringReadinessWhere = {
  status: ColoringStatus.PUBLISHED,
  publishedAt: { not: null },
  description: { not: null },
  themes: { some: {} },
  artwork: {
    is: {
      original: { is: publicOriginalReadinessWhere },
    },
  },
} satisfies Prisma.ColoringWhereInput;

export const publicVariantColoringWhere = {
  ...publicVariantColoringReadinessWhere,
  collection: { is: publicCollectionParentWhere },
} satisfies Prisma.ColoringWhereInput;

export const publicVariantCollectionWhere = {
  ...publicCollectionParentWhere,
  colorings: { some: publicVariantColoringReadinessWhere },
} satisfies Prisma.ColoringCollectionWhereInput;
