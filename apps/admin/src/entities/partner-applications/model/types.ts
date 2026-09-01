import type {
  PartnerApplicationAudienceSizeDTO,
  PartnerApplicationDTO,
  PartnerApplicationPartnerTypeDTO,
  PartnerApplicationPreferredContactDTO,
  PartnerApplicationsListParamsDTO,
  PartnerApplicationsPageDTO,
  PartnerApplicationStatusDTO,
} from "@/shared/actions/partner-applications";

export type PartnerApplication = PartnerApplicationDTO;
export type PartnerApplicationsPage = PartnerApplicationsPageDTO;
export type PartnerApplicationsListParams = PartnerApplicationsListParamsDTO;
export type PartnerApplicationStatus = PartnerApplicationStatusDTO;
export type PartnerApplicationPartnerType = PartnerApplicationPartnerTypeDTO;
export type PartnerApplicationAudienceSize = PartnerApplicationAudienceSizeDTO;
export type PartnerApplicationPreferredContact =
  PartnerApplicationPreferredContactDTO;
