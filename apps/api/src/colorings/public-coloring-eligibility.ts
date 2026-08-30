import {
  ColoringCollectionStatus,
  ColoringRevisionReviewDecision,
  ColoringStatus,
  Prisma,
  ProductStatus,
} from "../generated/prisma/client";

export const publicColoringReadinessWhere = {
  status: ColoringStatus.PUBLISHED,
  publishedRevisionId: { not: null },
  publishedAt: { not: null },
  description: { not: null },
  themes: { some: {} },
  publishedRevision: {
    is: {
      firstPublishedAt: { not: null },
      review: {
        is: { decision: ColoringRevisionReviewDecision.APPROVED },
      },
    },
  },
} satisfies Prisma.ColoringWhereInput;

export const publicCollectionParentWhere = {
  status: ColoringCollectionStatus.PUBLISHED,
  publishedAt: { not: null },
  coverUrl: { not: null },
  coverAlt: { not: null },
  coverWidth: { not: null },
  coverHeight: { not: null },
  product: { is: { status: ProductStatus.PUBLISHED } },
} satisfies Prisma.ColoringCollectionWhereInput;

export const publicColoringWhere = {
  ...publicColoringReadinessWhere,
  collection: { is: publicCollectionParentWhere },
} satisfies Prisma.ColoringWhereInput;

export const publicColoringCollectionWhere = {
  ...publicCollectionParentWhere,
  colorings: { some: publicColoringReadinessWhere },
} satisfies Prisma.ColoringCollectionWhereInput;
