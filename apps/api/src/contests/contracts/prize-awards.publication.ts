import type { Prisma } from "../../generated/prisma/client";
/** Immutable contest outcome. Consumers own issuance; contestants never write their tables. */
export const prizeAwardPublicationSelect = {
  id: true,
  userId: true,
  kind: true,
  place: true,
  title: true,
  contestTitle: true,
  contestSlug: true,
  productGroups: true,
  promoTerms: true,
  awardedAt: true,
} satisfies Prisma.ContestPrizeAwardSelect;
export type PublishedPrizeAward = Prisma.ContestPrizeAwardGetPayload<{
  select: typeof prizeAwardPublicationSelect;
}>;
export function mapProductPrizeAward(award: PublishedPrizeAward) {
  return {
    awardId: award.id,
    userId: award.userId,
    title: award.title,
    awardKind: award.kind,
    place: award.place,
    contestTitle: award.contestTitle,
    contestSlug: award.contestSlug,
    productGroups: award.productGroups as Prisma.InputJsonValue,
    awardedAt: award.awardedAt,
  };
}
export function mapPrizeAwardLabel(award: {
  kind?: string;
  awardKind?: string;
  place: number | null;
}) {
  return award.kind === "PARTICIPATION" || award.awardKind === "PARTICIPATION"
    ? { kind: "participation" as const }
    : award.place !== null
      ? { kind: "place" as const, place: award.place }
      : undefined;
}

export { readPrizeGroups } from "../prize-definitions";
