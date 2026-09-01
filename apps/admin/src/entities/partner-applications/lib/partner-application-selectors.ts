import type {
  PartnerApplication,
  PartnerApplicationAudienceSize,
  PartnerApplicationPartnerType,
  PartnerApplicationPreferredContact,
  PartnerApplicationStatus,
} from "../model";

const statusLabels: Record<PartnerApplicationStatus, string> = {
  new: "Новая",
  contacted: "Связались",
  approved: "Одобрена",
  rejected: "Отклонена",
};

const partnerTypeLabels: Record<PartnerApplicationPartnerType, string> = {
  creator: "Креатор",
  artist: "Художник",
  educator: "Преподаватель",
  studio: "Студия",
  retailer: "Магазин",
  other: "Другое",
};

const audienceSizeLabels: Record<PartnerApplicationAudienceSize, string> = {
  up_to_1000: "До 1 000",
  "1000_10000": "1 000–10 000",
  "10000_50000": "10 000–50 000",
  "50000_plus": "Более 50 000",
};

const preferredContactLabels: Record<
  PartnerApplicationPreferredContact,
  string
> = {
  email: "Email",
  telegram: "Telegram",
};

export function getPartnerApplicationStatusLabel(
  status: PartnerApplicationStatus,
) {
  return statusLabels[status];
}

export function getPartnerApplicationPartnerTypeLabel(
  partnerType: PartnerApplicationPartnerType,
) {
  return partnerTypeLabels[partnerType];
}

export function getPartnerApplicationAudienceSizeLabel(
  audienceSize: PartnerApplicationAudienceSize,
) {
  return audienceSizeLabels[audienceSize];
}

export function getPartnerApplicationPreferredContactLabel(
  preferredContact: PartnerApplicationPreferredContact,
) {
  return preferredContactLabels[preferredContact];
}

export function getPartnerApplicationContact(application: PartnerApplication) {
  if (application.preferredContact === "telegram") {
    return application.contactHandle || application.email;
  }

  return application.email;
}

export function getPartnerApplicationAttribution(
  application: PartnerApplication,
) {
  return [
    { label: "source", value: application.utmSource },
    { label: "medium", value: application.utmMedium },
    { label: "campaign", value: application.utmCampaign },
    { label: "content", value: application.utmContent },
    { label: "term", value: application.utmTerm },
  ].filter((item): item is { label: string; value: string } =>
    Boolean(item.value),
  );
}
