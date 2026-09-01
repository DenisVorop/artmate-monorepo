export const partnerTypes = [
  "creator",
  "artist",
  "educator",
  "studio",
  "retailer",
  "other",
] as const;

export const partnerAudienceSizes = [
  "up_to_1000",
  "1000_10000",
  "10000_50000",
  "50000_plus",
] as const;

export const partnerPreferredContacts = ["email", "telegram"] as const;

export type PartnerType = (typeof partnerTypes)[number];
export type PartnerAudienceSize = (typeof partnerAudienceSizes)[number];
export type PartnerPreferredContact = (typeof partnerPreferredContacts)[number];

export type SubmitPartnerApplicationInputDTO = {
  audienceSize: PartnerAudienceSize;
  channelUrl: string;
  comment?: string;
  contactHandle?: string;
  consent: true;
  email: string;
  name: string;
  partnerType: PartnerType;
  preferredContact: PartnerPreferredContact;
  utmCampaign?: string;
  utmContent?: string;
  utmMedium?: string;
  utmSource?: string;
  utmTerm?: string;
  website?: string;
};

export type PartnerApplicationResultDTO = {
  accepted: true;
};
