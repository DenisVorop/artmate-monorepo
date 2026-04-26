import { z } from "zod";

import type { CreateOrderInputDTO, OzonPickupPointDTO } from "@/shared/actions/orders";

export const checkoutPhonePlaceholder = "+7 (999) 999-99-99";
export const checkoutPhonePattern = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
const checkoutRussianNamePattern = /^[А-ЯЁа-яё]+(?:[ -][А-ЯЁа-яё]+)*$/;

export const checkoutFormValidationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .min(2, "Имя должно быть длиннее 1 символа")
    .regex(checkoutRussianNamePattern, "Имя может содержать только русские буквы"),
  phone: z
    .string()
    .min(1, "Укажите телефон")
    .regex(checkoutPhonePattern, `Введите телефон в формате ${checkoutPhonePlaceholder}`),
  email: z.string().trim().min(1, "Укажите email").email("Введите корректный email"),
  pickupPointId: z.string().min(1, "Выберите ПВЗ"),
  comment: z.string().max(1000, "Комментарий должен быть короче 1000 символов"),
  acceptedLegal: z.boolean().refine((value) => value, "Подтвердите согласие с условиями"),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormValidationSchema>;

export type CheckoutCustomerDefaults = Partial<Pick<CheckoutFormValues, "email" | "name" | "phone">>;

export function getDefaultCheckoutFormValues(
  pickupPoints: OzonPickupPointDTO[],
  customerDefaults: CheckoutCustomerDefaults = {},
): CheckoutFormValues {
  return {
    name: customerDefaults.name ?? "",
    phone: formatCheckoutPhone(customerDefaults.phone ?? ""),
    email: customerDefaults.email ?? "",
    pickupPointId: pickupPoints[0]?.id ?? "",
    comment: "",
    acceptedLegal: false,
  };
}

export function formatCheckoutPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const trimmedValue = value.trim();

  const localDigits =
    digits.startsWith("8") ||
    (digits.startsWith("7") && (trimmedValue.startsWith("+7") || digits.length > 10))
      ? digits.slice(1)
      : digits;
  const limitedDigits = localDigits.slice(0, 10);

  if (!limitedDigits) {
    return digits ? "+7" : "";
  }

  const areaCode = limitedDigits.slice(0, 3);
  const prefix = limitedDigits.slice(3, 6);
  const firstLinePart = limitedDigits.slice(6, 8);
  const secondLinePart = limitedDigits.slice(8, 10);

  let phone = `+7 (${areaCode}`;

  if (areaCode.length === 3) {
    phone += ")";
  }

  if (prefix) {
    phone += ` ${prefix}`;
  }

  if (firstLinePart) {
    phone += `-${firstLinePart}`;
  }

  if (secondLinePart) {
    phone += `-${secondLinePart}`;
  }

  return phone;
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
