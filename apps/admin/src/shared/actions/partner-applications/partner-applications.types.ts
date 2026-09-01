export const partnerApplicationStatuses = [
  "new",
  "contacted",
  "approved",
  "rejected",
] as const;

export type PartnerApplicationStatusDTO =
  (typeof partnerApplicationStatuses)[number];

export type PartnerApplicationPreferredContactDTO = "email" | "telegram";

export type PartnerApplicationPartnerTypeDTO =
  | "creator"
  | "artist"
  | "educator"
  | "studio"
  | "retailer"
  | "other";

export type PartnerApplicationAudienceSizeDTO =
  | "up_to_1000"
  | "1000_10000"
  | "10000_50000"
  | "50000_plus";

export type PartnerApplicationDTO = {
  id: string;
  name: string;
  email: string;
  preferredContact: PartnerApplicationPreferredContactDTO;
  contactHandle?: string | null;
  channelUrl: string;
  partnerType: PartnerApplicationPartnerTypeDTO;
  audienceSize: PartnerApplicationAudienceSizeDTO;
  comment?: string | null;
  consent: true;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  status: PartnerApplicationStatusDTO;
  createdAt: string;
  updatedAt: string;
};

export type PartnerApplicationsListParamsDTO = {
  page: number;
  pageSize: number;
  status?: PartnerApplicationStatusDTO;
};

export type PartnerApplicationsPageDTO = {
  items: PartnerApplicationDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UpdatePartnerApplicationStatusInputDTO = {
  status: PartnerApplicationStatusDTO;
};

export type PartnerApplicationMutationResultDTO =
  | {
      ok: true;
      data: PartnerApplicationDTO;
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };
