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
