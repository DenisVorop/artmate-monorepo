import type { Prisma } from "../../generated/prisma/client";

/** Finalized winners and a frozen album definition. Orders consumes this
 * publication; contests never invokes orders or changes entitlements. */
export const albumPrizeWinnerPublicationSelect = {
  id: true,
  entry: { select: { userId: true } },
  draw: {
    select: {
      createdAt: true,
      contest: {
        select: {
          title: true,
          slug: true,
          prizeAlbumQuantity: true,
          prizeAlbumIds: true,
        },
      },
    },
  },
} satisfies Prisma.ContestDrawWinnerSelect;

type PublishedWinner = Prisma.ContestDrawWinnerGetPayload<{
  select: typeof albumPrizeWinnerPublicationSelect;
}>;
export function mapAlbumPrizeWinnerPublication(winner: PublishedWinner) {
  return {
    winnerId: winner.id,
    userId: winner.entry.userId,
    quantity: winner.draw.contest.prizeAlbumQuantity!,
    albumIds: winner.draw.contest.prizeAlbumIds,
    contestTitle: winner.draw.contest.title,
    contestSlug: winner.draw.contest.slug,
    awardedAt: winner.draw.createdAt,
  };
}
