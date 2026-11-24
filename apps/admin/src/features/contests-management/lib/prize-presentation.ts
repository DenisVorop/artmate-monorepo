import type { ContestPrizePresentation } from "@repo/ui/contest-prizes";
import type { ContestFormValues } from "./form-values";

export function toPrizePresentation(
  values: Pick<
    ContestFormValues,
    | "hasMarkerPrize"
    | "prizeMarkerQuantity"
    | "prizeMode"
    | "prizePlaces"
    | "prize"
    | "prizeDetail"
    | "hasParticipationPrize"
    | "participationPromoCodeId"
  >,
  promoLabel: (_id: string) => string,
): ContestPrizePresentation {
  return {
    mode: values.prizeMode === "PLACES" ? "places" : "equal",
    winners:
      values.prizeMode === "PLACES"
        ? values.prizePlaces.map((prize, index) => {
            const count = Number(prize.winnersCount);
            return {
              place: index + 1,
              winnersCount:
                Number.isInteger(count) && count > 0 ? count : undefined,
              title: prize.prize || "Приз не указан",
              detail: [
                prize.prizeDetail,
                !prize.deferredProduct &&
                prize.hasMarkerPrize &&
                !prize.prize.toLowerCase().includes("маркер")
                  ? markerPrizeLabel(prize.prizeMarkerQuantity)
                  : "",
                prize.prizePromoCodeId
                  ? promoLabel(prize.prizePromoCodeId)
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
            };
          })
        : [
            {
              title: values.prize || "Приз не указан",
              detail: [
                values.prizeDetail,
                values.hasMarkerPrize &&
                !values.prize.toLowerCase().includes("маркер")
                  ? markerPrizeLabel(values.prizeMarkerQuantity)
                  : "",
              ]
                .filter(Boolean)
                .join(" · "),
            },
          ],
    participation: values.hasParticipationPrize
      ? {
          title: values.participationPromoCodeId
            ? promoLabel(values.participationPromoCodeId)
            : "Промокод не выбран",
        }
      : undefined,
  };
}

function markerPrizeLabel(quantity: number) {
  return `${quantity} ${quantity === 1 ? "набор" : quantity < 5 ? "набора" : "наборов"} маркеров на выбор`;
}
