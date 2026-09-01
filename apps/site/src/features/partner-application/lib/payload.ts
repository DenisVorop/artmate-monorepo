import type { SubmitPartnerApplicationInputDTO } from "@/shared/actions/partner-applications";

import type { PartnerApplicationFormValues } from "./form-values";
import { normalizeTelegramContact } from "./telegram-contact";

const utmFieldMap = {
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_medium: "utmMedium",
  utm_source: "utmSource",
  utm_term: "utmTerm",
} as const;

export function buildPartnerApplicationPayload(
  values: PartnerApplicationFormValues,
): SubmitPartnerApplicationInputDTO {
  const utm = getUtmPayload();
  const contactHandle = normalizeTelegramContact(values.contactHandle);
  const comment = values.comment.trim();

  return {
    audienceSize: values.audienceSize,
    channelUrl: values.channelUrl.trim(),
    consent: true,
    email: values.email.trim(),
    name: values.name.trim(),
    partnerType: values.partnerType,
    preferredContact: values.preferredContact,
    website: values.website?.trim(),
    ...(values.preferredContact === "telegram" && contactHandle ? { contactHandle } : {}),
    ...(comment ? { comment } : {}),
    ...utm,
  };
}

function getUtmPayload() {
  if (typeof window === "undefined") {
    return {};
  }

  const searchParams = new URLSearchParams(window.location.search);

  return Object.entries(utmFieldMap).reduce<
    Partial<
      Pick<
        SubmitPartnerApplicationInputDTO,
        "utmCampaign" | "utmContent" | "utmMedium" | "utmSource" | "utmTerm"
      >
    >
  >((result, [queryName, payloadName]) => {
    const value = searchParams.get(queryName)?.trim().slice(0, 200);

    if (value) {
      result[payloadName] = value;
    }

    return result;
  }, {});
}
