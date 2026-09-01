import {
  ColoringCollectionStatus,
  ColoringStatus,
  Prisma,
  ProductStatus,
  UserStatus,
  WorkshopRevisionStatus,
} from "../generated/prisma/client";

export const publicWorkshopWorkWhere = {
  deletedAt: null,
  isPublicationEnabled: true,
  publishedAt: { not: null },
  publishedRevisionId: { not: null },
  coloring: {
    is: {
      status: ColoringStatus.PUBLISHED,
      publishedRevisionId: { not: null },
      collection: {
        is: {
          status: ColoringCollectionStatus.PUBLISHED,
          product: { is: { status: ProductStatus.PUBLISHED } },
        },
      },
    },
  },
  workshop: {
    is: {
      isPublic: true,
      owner: { is: { status: UserStatus.ACTIVE, deletedAt: null } },
    },
  },
  publishedRevision: {
    is: { status: WorkshopRevisionStatus.APPROVED },
  },
} satisfies Prisma.WorkshopWorkWhereInput;
