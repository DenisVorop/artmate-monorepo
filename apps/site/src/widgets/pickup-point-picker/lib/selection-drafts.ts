import type { DeliveryCityDTO, DeliveryPickupPointDTO } from "@/shared/actions/delivery";

export type CdekDeliveryDraft = {
  city?: DeliveryCityDTO;
  cityCode?: number;
  pickupPoint?: DeliveryPickupPointDTO;
  pickupPointId?: string;
};

export type OzonDeliveryDraft = {
  city?: DeliveryCityDTO;
  cityCode?: number;
  pickupPoint?: DeliveryPickupPointDTO;
  pickupPointId?: string;
};

export type DeliveryPickerDrafts = {
  cdek: CdekDeliveryDraft;
  ozon: OzonDeliveryDraft;
};

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
  provider: "cdek" | "ozon",
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
