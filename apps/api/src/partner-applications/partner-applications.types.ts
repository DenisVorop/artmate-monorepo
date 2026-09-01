export const partnerApplicationStatuses = [
  "new",
  "contacted",
  "approved",
  "rejected",
] as const;
export type PartnerApplicationStatus =
  (typeof partnerApplicationStatuses)[number];

export const partnerApplicationPreferredContacts = [
  "email",
  "telegram",
] as const;
export type PartnerApplicationPreferredContact =
  (typeof partnerApplicationPreferredContacts)[number];

export const partnerApplicationTypes = [
  "creator",
  "artist",
  "educator",
  "studio",
  "retailer",
  "other",
] as const;
export type PartnerApplicationType = (typeof partnerApplicationTypes)[number];

export const partnerApplicationAudienceSizes = [
  "up_to_1000",
  "1000_10000",
  "10000_50000",
  "50000_plus",
] as const;
export type PartnerApplicationAudienceSize =
  (typeof partnerApplicationAudienceSizes)[number];
