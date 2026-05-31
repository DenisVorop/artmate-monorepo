import { z } from "zod";

import type { CreateOrderInputDTO } from "@/shared/actions/orders";

export const checkoutPhonePlaceholder = "+7 (999) 999-99-99";
export const checkoutPhonePattern = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
export const checkoutOrderFormId = "checkout-order-form";
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
  comment: z.string().max(1000, "Комментарий должен быть короче 1000 символов"),
  acceptedLegal: z.boolean().refine((value) => value, "Примите условия публичной оферты"),
  acceptedPersonalDataConsent: z
    .boolean()
    .refine((value) => value, "Подтвердите согласие на обработку персональных данных"),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormValidationSchema>;

export type CheckoutCustomerDefaults = Partial<
  Pick<CheckoutFormValues, "email" | "name" | "phone">
>;
export type CheckoutDeliverySelection = CreateOrderInputDTO["delivery"];
export type CheckoutSubmitLabelInput = {
  hasDelivery: boolean;
  isDeliveryPending: boolean;
  isSubmitting: boolean;
  requiresAuth: boolean;
};

export function getDefaultCheckoutFormValues(
  customerDefaults: CheckoutCustomerDefaults = {},
): CheckoutFormValues {
  return {
    name: customerDefaults.name ?? "",
    phone: formatCheckoutPhone(customerDefaults.phone ?? ""),
    email: customerDefaults.email ?? "",
    comment: "",
    acceptedLegal: false,
    acceptedPersonalDataConsent: false,
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

export function toCreateOrderInput(
  values: CheckoutFormValues,
  delivery: CheckoutDeliverySelection,
): CreateOrderInputDTO {
  const comment = values.comment.trim();

  return {
    customer: {
      name: values.name.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
    },
    delivery,
    payment: {
      method: "ozon_acquiring",
    },
    comment: comment || undefined,
    acceptedLegal: values.acceptedLegal,
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
  };
}

export function getCheckoutSubmitLabel({
  hasDelivery,
  isDeliveryPending,
  isSubmitting,
  requiresAuth,
}: CheckoutSubmitLabelInput) {
  if (isSubmitting) {
    return "Отправляем заказ";
  }

  if (!hasDelivery) {
    return "Выберите ПВЗ";
  }

  if (isDeliveryPending) {
    return "Считаем доставку";
  }

  return requiresAuth ? "Войти и оплатить" : "Перейти к оплате";
}
