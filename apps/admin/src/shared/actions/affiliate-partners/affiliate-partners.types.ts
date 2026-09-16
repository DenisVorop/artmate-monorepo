export type AffiliatePartnerStatusDTO = "active" | "suspended";

export type AffiliateContractDTO = {
  number: string;
  signedAt: string;
  paymentDetails: string;
};

export type AffiliatePartnerSummaryDTO = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: AffiliatePartnerStatusDTO;
  partnerApplicationId: string | null;
  minimumPayoutKopecks: number | null;
  effectiveMinimumPayoutKopecks: number;
  contractVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type AffiliatePartnerDTO = AffiliatePartnerSummaryDTO & {
  contract: AffiliateContractDTO;
};

export type AffiliateContractRevisionDTO = AffiliateContractDTO & {
  version: number;
  changedAt: string;
  changedByUserId: string;
};

export type AffiliatePartnersListParamsDTO = {
  page: number;
  pageSize: number;
  search?: string;
};

export type AffiliatePartnersPageDTO = {
  items: AffiliatePartnerSummaryDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export type AffiliateCodeDTO = {
  id: string;
  code: string;
  comment: string | null;
  partnerPercent: number;
  buyerPercent: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AffiliateCodesListParamsDTO = {
  page: number;
  pageSize: number;
};

export type AffiliateCodesPageDTO = {
  items: AffiliateCodeDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export type UpdateAffiliateCodeInputDTO = {
  comment?: string | null;
  partnerPercent?: number;
  isActive?: boolean;
};

export type UpdateAffiliatePartnerInputDTO = {
  status: AffiliatePartnerStatusDTO;
  partnerApplicationId: string | null;
  minimumPayoutKopecks: number | null;
  contract: AffiliateContractDTO;
};
