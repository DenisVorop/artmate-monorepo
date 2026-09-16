export type AffiliatePartnerDTO = {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: "active" | "suspended";
  partnerApplicationId: string | null;
  minimumPayoutKopecks: number | null;
  effectiveMinimumPayoutKopecks: number;
  contractVersion: number;
  createdAt: string;
  updatedAt: string;
  contract: {
    number: string;
    signedAt: string;
    paymentDetails: string;
  };
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

export type AffiliateCodeListDTO = {
  items: AffiliateCodeDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateAffiliateCodeInputDTO = {
  code?: string;
  comment?: string | null;
  partnerPercent: number;
};

export type UpdateAffiliateCodeInputDTO = {
  comment?: string | null;
  partnerPercent?: number;
  isActive?: boolean;
};
