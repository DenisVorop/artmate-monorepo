import type { CreateOrderInputDTO, OzonPickupPointDTO } from "@/shared/actions/orders";

export type CheckoutFormValues = {
  name: string;
  phone: string;
  email: string;
  pickupPointId: string;
  comment: string;
  acceptedLegal: boolean;
};

export function getDefaultCheckoutFormValues(
  pickupPoints: OzonPickupPointDTO[],
): CheckoutFormValues {
  return {
    name: "",
    phone: "",
    email: "",
    pickupPointId: pickupPoints[0]?.id ?? "",
    comment: "",
    acceptedLegal: false,
  };
}

export function getSelectedPickupPoint(pickupPoints: OzonPickupPointDTO[], pickupPointId: string) {
  return pickupPoints.find((pickupPoint) => pickupPoint.id === pickupPointId);
}

export function toCreateOrderInput(values: CheckoutFormValues): CreateOrderInputDTO {
  const comment = values.comment.trim();

  return {
    customer: {
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
    },
    delivery: {
      provider: "ozon",
      pickupPointId: values.pickupPointId,
    },
    payment: {
      method: "bank_card_mock",
    },
    comment: comment || undefined,
    acceptedLegal: values.acceptedLegal,
  };
}
