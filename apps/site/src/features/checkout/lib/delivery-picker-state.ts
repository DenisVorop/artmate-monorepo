import type {
  DeliveryCityDTO,
  DeliveryPickupPointDTO,
  OzonDeliveryMapRequestDTO,
} from "@/shared/actions/delivery";
import type { CheckoutCalculationDTO } from "@/shared/actions/orders";

import type { CheckoutDeliverySelection } from "./checkout-form";

export type CdekDeliveryDraft = {
  city?: DeliveryCityDTO;
  cityCode?: number;
  pickupPoint?: DeliveryPickupPointDTO;
  pickupPointId?: string;
};

export type OzonDeliveryDraft = {
  city?: DeliveryCityDTO;
  cityCode?: number;
  mapRequest?: OzonDeliveryMapRequestDTO;
  pickupPoint?: DeliveryPickupPointDTO;
  pickupPointId?: string;
};

export type DeliveryPickerDrafts = {
  cdek: CdekDeliveryDraft;
  ozon: OzonDeliveryDraft;
};

export type PickupPointsMapFocus = {
  key: string;
  points: Array<{ lat: number; long: number }>;
};

type ConfirmationInput = {
  calculate: () => Promise<unknown>;
  candidate: CheckoutDeliverySelection;
  cartId: string;
  commit: (_result: {
    calculation: CheckoutCalculationDTO;
    candidate: CheckoutDeliverySelection;
  }) => void;
  isCurrent?: () => boolean;
};

export type DeliveryConfirmationResult =
  | { status: "confirmed"; calculation: CheckoutCalculationDTO }
  | { status: "error"; message: string }
  | { status: "stale" };

const moscowMapView = {
  center: { lat: 55.75, long: 37.62 },
  zoom: 11,
};

export function createDeliveryPickerDrafts(
  confirmed?: CheckoutDeliverySelection,
): DeliveryPickerDrafts {
  return {
    cdek:
      confirmed?.provider === "cdek"
        ? { cityCode: confirmed.cityCode, pickupPointId: confirmed.pickupPointId }
        : {},
    ozon: confirmed?.provider === "ozon" ? { pickupPointId: confirmed.pickupPointId } : {},
  };
}

export function seedDeliveryPickerDrafts(
  drafts: DeliveryPickerDrafts,
  confirmed: CheckoutDeliverySelection | undefined,
  calculation: CheckoutCalculationDTO | undefined,
): DeliveryPickerDrafts {
  if (!confirmed) return drafts;

  const withConfirmedTechnicalSelection = seedConfirmedTechnicalSelection(drafts, confirmed);

  if (!isMatchingCheckoutCalculation(calculation, confirmed, calculation?.cartId)) {
    return withConfirmedTechnicalSelection;
  }

  const pickupPoint = calculation.delivery.pickupPoint;

  if (
    confirmed.provider === "cdek" &&
    withConfirmedTechnicalSelection.cdek.cityCode === confirmed.cityCode &&
    withConfirmedTechnicalSelection.cdek.pickupPointId === confirmed.pickupPointId
  ) {
    return {
      ...withConfirmedTechnicalSelection,
      cdek: { ...withConfirmedTechnicalSelection.cdek, pickupPoint },
    };
  }

  if (
    confirmed.provider === "ozon" &&
    withConfirmedTechnicalSelection.ozon.pickupPointId === confirmed.pickupPointId
  ) {
    return {
      ...withConfirmedTechnicalSelection,
      ozon: { ...withConfirmedTechnicalSelection.ozon, pickupPoint },
    };
  }

  return withConfirmedTechnicalSelection;
}

export function selectDraftCity(
  drafts: DeliveryPickerDrafts,
  city: DeliveryCityDTO,
): DeliveryPickerDrafts {
  return {
    ...drafts,
    cdek: { city, cityCode: city.code },
  };
}

export function clearCdekDraftCity(drafts: DeliveryPickerDrafts): DeliveryPickerDrafts {
  return { ...drafts, cdek: {} };
}

export function selectOzonDraftCity(
  drafts: DeliveryPickerDrafts,
  city: DeliveryCityDTO,
): DeliveryPickerDrafts {
  return {
    ...drafts,
    ozon: { city, cityCode: city.code },
  };
}

export function clearOzonDraftCity(drafts: DeliveryPickerDrafts): DeliveryPickerDrafts {
  return { ...drafts, ozon: {} };
}

export function selectDraftPickupPoint(
  drafts: DeliveryPickerDrafts,
  provider: CheckoutDeliverySelection["provider"],
  pickupPoint: DeliveryPickupPointDTO,
): DeliveryPickerDrafts {
  if (provider === "cdek") {
    return {
      ...drafts,
      cdek: {
        ...drafts.cdek,
        pickupPoint,
        pickupPointId: pickupPoint.id,
      },
    };
  }

  return {
    ...drafts,
    ozon: {
      ...drafts.ozon,
      pickupPoint,
      pickupPointId: pickupPoint.id,
    },
  };
}

export function setOzonDraftMapRequest(
  drafts: DeliveryPickerDrafts,
  mapRequest: OzonDeliveryMapRequestDTO,
): DeliveryPickerDrafts {
  return { ...drafts, ozon: { ...drafts.ozon, mapRequest } };
}

export function getDeliveryDraftCandidate(
  drafts: DeliveryPickerDrafts,
  provider: CheckoutDeliverySelection["provider"],
): CheckoutDeliverySelection | undefined {
  if (provider === "cdek") {
    const { cityCode, pickupPointId } = drafts.cdek;

    return cityCode && pickupPointId ? { cityCode, pickupPointId, provider: "cdek" } : undefined;
  }

  return drafts.ozon.pickupPointId
    ? { pickupPointId: drafts.ozon.pickupPointId, provider: "ozon" }
    : undefined;
}

export function isSameDeliverySelection(
  left: CheckoutDeliverySelection | undefined,
  right: CheckoutDeliverySelection | undefined,
) {
  return (
    left?.provider === right?.provider &&
    left?.pickupPointId === right?.pickupPointId &&
    (left?.provider !== "cdek" || (right?.provider === "cdek" && left.cityCode === right.cityCode))
  );
}

export function getOzonDraftInitialView(draft: OzonDeliveryDraft) {
  const point = draft.pickupPoint;

  if (
    typeof point?.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude)
  ) {
    return {
      center: { lat: point.latitude, long: point.longitude },
      zoom: draft.mapRequest?.zoom ?? 15,
    };
  }

  if (draft.mapRequest) {
    const { leftBottom, rightTop } = draft.mapRequest.viewport;

    return {
      center: {
        lat: (leftBottom.lat + rightTop.lat) / 2,
        long: (leftBottom.long + rightTop.long) / 2,
      },
      zoom: draft.mapRequest.zoom,
    };
  }

  return moscowMapView;
}

export function getOzonLocatorMapFocus(
  selectedCityCode: number | undefined,
  locatorCityCode: number | undefined,
  pickupPoints: readonly DeliveryPickupPointDTO[],
): PickupPointsMapFocus | undefined {
  if (!selectedCityCode || selectedCityCode !== locatorCityCode) {
    return undefined;
  }

  const points = pickupPoints.flatMap((point) =>
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude)
      ? [{ lat: point.latitude, long: point.longitude }]
      : [],
  );

  return points.length > 0 ? { key: `ozon-city:${selectedCityCode}`, points } : undefined;
}

export function isMatchingCheckoutCalculation(
  value: unknown,
  candidate: CheckoutDeliverySelection,
  cartId: string | undefined,
): value is CheckoutCalculationDTO {
  if (!isRecord(value) || !isNonEmptyString(cartId)) return false;

  const delivery = value.delivery;
  if (!isRecord(delivery)) return false;

  const point = delivery.pickupPoint;
  if (!isRecord(point)) return false;

  const { deliveryPrice, discount, subtotal, total } = value;

  if (
    value.cartId !== cartId ||
    !isPositiveInteger(value.itemsCount) ||
    !isNonNegativeFiniteNumber(subtotal) ||
    !isNonNegativeFiniteNumber(discount) ||
    toMinorUnits(discount) > toMinorUnits(subtotal) ||
    !isNonNegativeFiniteNumber(deliveryPrice) ||
    !isNonNegativeFiniteNumber(total) ||
    value.currency !== "RUB" ||
    (value.promoCode !== undefined && value.promoCode !== null && typeof value.promoCode !== "string") ||
    delivery.provider !== candidate.provider ||
    point.id !== candidate.pickupPointId ||
    !isNonEmptyString(point.id) ||
    !isNonEmptyString(point.title) ||
    !isNonEmptyString(point.address) ||
    !isNonEmptyString(point.workHours) ||
    !isNonNegativeFiniteNumber(point.deliveryPrice) ||
    !isOptionalFiniteNumber(point.latitude) ||
    !isOptionalFiniteNumber(point.longitude) ||
    !isOptionalPositiveInteger(point.cityCode) ||
    toMinorUnits(deliveryPrice) !== toMinorUnits(point.deliveryPrice) ||
    toMinorUnits(total) !==
      toMinorUnits(subtotal) - toMinorUnits(discount) + toMinorUnits(deliveryPrice) ||
    !isOptionalDeliveryDateRange(value.estimatedDeliveryDateRange)
  ) {
    return false;
  }

  return (
    candidate.provider === "ozon" ||
    (Number.isInteger(candidate.cityCode) &&
      candidate.cityCode > 0 &&
      point.cityCode === candidate.cityCode)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isOptionalFiniteNumber(value: unknown) {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isOptionalPositiveInteger(value: unknown) {
  return value === undefined || isPositiveInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isOptionalDeliveryDateRange(value: unknown) {
  return (
    value === undefined ||
    (isRecord(value) && isNonEmptyString(value.min) && isNonEmptyString(value.max))
  );
}

function toMinorUnits(value: number) {
  return Math.round(value * 100);
}

export function createDeliveryConfirmationCoordinator() {
  let requestToken = 0;

  return {
    async confirm({ calculate, candidate, cartId, commit, isCurrent }: ConfirmationInput) {
      const ownToken = ++requestToken;

      try {
        const calculation = await calculate();

        if (ownToken !== requestToken || isCurrent?.() === false) {
          return { status: "stale" } as const;
        }

        if (!isMatchingCheckoutCalculation(calculation, candidate, cartId)) {
          return {
            status: "error",
            message: "Сервер вернул некорректный расчет доставки. Попробуйте еще раз.",
          } as const;
        }

        commit({ calculation, candidate });
        return { status: "confirmed", calculation } as const;
      } catch {
        if (ownToken !== requestToken || isCurrent?.() === false) {
          return { status: "stale" } as const;
        }

        return {
          status: "error",
          message:
            "Не удалось подтвердить пункт выдачи. Проверьте соединение и попробуйте еще раз.",
        } as const;
      }
    },
    invalidate(_reason?: string) {
      requestToken += 1;
    },
  };
}

function seedConfirmedTechnicalSelection(
  drafts: DeliveryPickerDrafts,
  confirmed: CheckoutDeliverySelection,
) {
  if (confirmed.provider === "cdek" && !drafts.cdek.cityCode) {
    return {
      ...drafts,
      cdek: {
        ...drafts.cdek,
        cityCode: confirmed.cityCode,
        pickupPointId: confirmed.pickupPointId,
      },
    };
  }

  if (confirmed.provider === "ozon" && !drafts.ozon.pickupPointId) {
    return {
      ...drafts,
      ozon: { ...drafts.ozon, pickupPointId: confirmed.pickupPointId },
    };
  }

  return drafts;
}
