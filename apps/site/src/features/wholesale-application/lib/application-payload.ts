import type { SubmitContactMessageInputDTO } from "@/shared/actions/contact-form";

import type { WholesaleApplicationValues } from "./form-values";

export function buildWholesaleApplicationPayload(
  values: WholesaleApplicationValues,
): SubmitContactMessageInputDTO {
  return {
    name: values.company.trim(),
    email: values.email.trim(),
    message: values.task.trim(),
    topic: "Оптовый заказ",
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
  };
}
