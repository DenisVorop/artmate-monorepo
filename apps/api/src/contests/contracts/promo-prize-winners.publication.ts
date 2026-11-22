import type { Prisma } from "../../generated/prisma/client";

/** Finalized winners and frozen promo terms. Personal codes belong to promocodes. */
export const promoPrizeWinnerPublicationSelect = {
  id: true,
  entry: { select: { userId: true } },
  draw: {
    select: {
      createdAt: true,
      contest: {
        select: {
          title: true,
          slug: true,
          prizePromoTerms: true,
        },
      },
    },
  },
} satisfies Prisma.ContestDrawWinnerSelect;
