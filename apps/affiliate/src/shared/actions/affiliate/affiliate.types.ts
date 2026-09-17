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
  limit: number;
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

export type AffiliateAnalyticsDaysDTO = 7 | 30 | 90;

export type AffiliateMetricsDTO = {
  orderCount: number;
  salesKopecks: number;
  earnedKopecks: number;
  reversedKopecks: number;
  netKopecks: number;
};

export type AffiliateAnalyticsPeriodDTO = {
  days: AffiliateAnalyticsDaysDTO;
  from: string;
  to: string;
  timeZone: "Europe/Moscow";
};

export type AffiliateBalanceDTO = {
  availableKopecks: number;
  pendingKopecks: number;
  heldKopecks: number;
  reversedKopecks: number;
};

export type AffiliateAnalyticsDTO = {
  asOf: string;
  period: AffiliateAnalyticsPeriodDTO;
  balance: AffiliateBalanceDTO;
  totals: AffiliateMetricsDTO;
  daily: Array<AffiliateMetricsDTO & { date: string }>;
  codes: {
    items: Array<AffiliateMetricsDTO & { code: string }>;
    total: number;
    page: number;
    pageSize: number;
  };
};

export type AffiliateLedgerItemDTO = {
  id: string;
  code: string;
  kind: "credit" | "reversal";
  amountKopecks: number;
  createdAt: string;
  availableAt: string | null;
  holdReason:
    | "order_cancelled"
    | "payment_not_confirmed"
    | "order_not_completed"
    | null;
  status: "pending" | "available" | "held" | "reversed" | "not_earned";
  isSelfPurchase: boolean;
  partnerPercent: number;
};

export type AffiliateLedgerDTO = {
  asOf: string;
  period: AffiliateAnalyticsPeriodDTO;
  items: AffiliateLedgerItemDTO[];
  total: number;
  page: number;
  pageSize: number;
};
