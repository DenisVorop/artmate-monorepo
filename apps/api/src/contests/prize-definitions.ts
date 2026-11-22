import type { Contest, Prisma } from "../generated/prisma/client";
import type { PromoPrizeTerms } from "../promocodes/contracts/prize-template.publication";
export type ProductPrizeGroup = {
  kind: "albums" | "markers";
  quantity: number;
  productIds: string[];
};
export type PrizeDefinition = {
  prize: string;
  prizeDetail: string;
  prizeAlbumQuantity: number | null;
  prizeAlbumIds: string[];
  prizeMarkerQuantity: number | null;
  prizeMarkerIds: string[];
  prizePromoCodeId: string | null;
  prizePromoTerms: PromoPrizeTerms | null;
};
export type PrizeDefinitionInput = Omit<PrizeDefinition, "prizePromoTerms">;
export function normalizePrize(
  input: Partial<PrizeDefinitionInput>,
): PrizeDefinitionInput {
  return {
    prize: input.prize?.trim() ?? "",
    prizeDetail: input.prizeDetail?.trim() ?? "",
    prizeAlbumQuantity: input.prizeAlbumQuantity ?? null,
    prizeAlbumIds: [...(input.prizeAlbumIds ?? [])].sort(),
    prizeMarkerQuantity: input.prizeMarkerQuantity ?? null,
    prizeMarkerIds: [...(input.prizeMarkerIds ?? [])].sort(),
    prizePromoCodeId: input.prizePromoCodeId ?? null,
  };
}
export function contestPrizes(
  contest: Pick<
    Contest,
    | "prizeMode"
    | "prizePlaces"
    | "prize"
    | "prizeDetail"
    | "prizeAlbumQuantity"
    | "prizeAlbumIds"
    | "prizeMarkerQuantity"
    | "prizeMarkerIds"
    | "prizePromoCodeId"
    | "prizePromoTerms"
  >,
): PrizeDefinition[] {
  return contest.prizeMode === "PLACES"
    ? (contest.prizePlaces as unknown as PrizeDefinition[])
    : [
        {
          ...normalizePrize(contest),
          prizePromoTerms: contest.prizePromoTerms as PromoPrizeTerms | null,
        },
      ];
}
export function prizeProductGroups(
  prize: PrizeDefinitionInput,
): ProductPrizeGroup[] {
  return [
    ...(prize.prizeAlbumQuantity !== null
      ? [
          {
            kind: "albums" as const,
            quantity: prize.prizeAlbumQuantity,
            productIds: prize.prizeAlbumIds,
          },
        ]
      : []),
    ...(prize.prizeMarkerQuantity !== null
      ? [
          {
            kind: "markers" as const,
            quantity: prize.prizeMarkerQuantity,
            productIds: prize.prizeMarkerIds,
          },
        ]
      : []),
  ];
}
export function readPrizeGroups(value: Prisma.JsonValue): ProductPrizeGroup[] {
  const groups = value as unknown as ProductPrizeGroup[];
  if (
    !Array.isArray(groups) ||
    groups.some(
      (group) =>
        !group ||
        !["albums", "markers"].includes(group.kind) ||
        !Number.isInteger(group.quantity) ||
        group.quantity < 1 ||
        group.quantity > 20 ||
        !Array.isArray(group.productIds) ||
        group.productIds.length < group.quantity ||
        group.productIds.some((id) => typeof id !== "string") ||
        new Set(group.productIds).size !== group.productIds.length,
    )
  )
    throw new Error("Invalid published prize groups");
  const ids = groups.flatMap((group) => group.productIds);
  if (new Set(ids).size !== ids.length)
    throw new Error("Overlapping published prize groups");
  return groups;
}
export function promoPrizeLabel(terms: PromoPrizeTerms) {
  return `Промокод на скидку ${terms.type === "PERCENTAGE" ? `${terms.basisPoints! / 100}%` : `${terms.amountKopecks! / 100} ₽`}`;
}
export function prizePresentation(
  contest: Parameters<typeof contestPrizes>[0] &
    Pick<Contest, "participationPromoTerms">,
) {
  return {
    mode:
      contest.prizeMode === "PLACES" ? ("places" as const) : ("equal" as const),
    winners: contestPrizes(contest).map((prize, index) => ({
      ...(contest.prizeMode === "PLACES" ? { place: index + 1 } : {}),
      title: prize.prize,
      detail: [
        prize.prizeDetail,
        prize.prizePromoTerms ? promoPrizeLabel(prize.prizePromoTerms) : "",
      ]
        .filter(Boolean)
        .join(" · "),
    })),
    ...(contest.participationPromoTerms
      ? {
          participation: {
            title: promoPrizeLabel(
              contest.participationPromoTerms as unknown as PromoPrizeTerms,
            ),
          },
        }
      : {}),
  };
}
