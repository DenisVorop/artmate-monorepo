import { ColoringStatus, Prisma } from "../generated/prisma/client";
import { publicCollectionParentWhere } from "./public-coloring-eligibility";

export const publicVariantColoringReadinessWhere = {
  status: ColoringStatus.PUBLISHED,
  publishedAt: { not: null },
  description: { not: null },
  themes: { some: {} },
  artwork: {
    is: {
      original: {
        is: { status: ColoringStatus.PUBLISHED, publishedAt: { not: null } },
      },
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
