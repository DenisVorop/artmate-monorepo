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
  reservedKopecks: number;
  paidKopecks: number;
  debtKopecks: number;
  pendingKopecks: number;
  heldKopecks: number;
  reversedKopecks: number;
};

export type AffiliatePayoutStatusDTO =
  | "pending"
  | "paid"
  | "rejected"
  | "cancelled";

export type AffiliatePayoutEventDTO = {
  id: string;
  status: AffiliatePayoutStatusDTO;
  createdAt: string;
  actorUserId: string | null;
  reason: string | null;
};

export type AffiliatePayoutDTO = {
  id: string;
  status: AffiliatePayoutStatusDTO;
  amountKopecks: number;
  minimumPayoutKopecks: number;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  reference: string | null;
  reason: string | null;
  contract: {
    version: number;
    number: string;
    signedAt: string;
    paymentDetails: string;
  };
  events: AffiliatePayoutEventDTO[];
};

export type AffiliatePayoutBlockedReasonDTO =
  | "partner_inactive"
  | "open_request"
  | "debt"
  | "no_available_balance"
  | "below_minimum";

export type AffiliatePayoutSummaryDTO = {
  asOf: string;
  availableKopecks: number;
  reservedKopecks: number;
  paidKopecks: number;
  debtKopecks: number;
  minimumPayoutKopecks: number;
  canRequest: boolean;
  blockedReason: AffiliatePayoutBlockedReasonDTO | null;
};

export type AffiliatePayoutListDTO = {
  summary: AffiliatePayoutSummaryDTO;
  items: AffiliatePayoutDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export type CreateAffiliatePayoutInputDTO = {
  requestId: string;
  amountKopecks: number;
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
