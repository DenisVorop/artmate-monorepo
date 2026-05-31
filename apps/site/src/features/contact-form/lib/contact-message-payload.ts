import type { SubmitContactMessageInputDTO } from "@/shared/actions/contact-form";

import type { ContactFormValues } from "./form-values";

export function buildContactMessagePayload(
  values: ContactFormValues,
): SubmitContactMessageInputDTO {
  return {
    acceptedPersonalDataConsent: values.acceptedPersonalDataConsent,
    email: values.email.trim(),
    message: values.message.trim(),
    name: values.name.trim(),
    ...(values.order.trim() ? { order: values.order.trim() } : {}),
    ...(values.topic.trim() ? { topic: values.topic.trim() } : {}),
  };
}
