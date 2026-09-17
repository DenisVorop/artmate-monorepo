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
  limit: number;
};

export type AffiliateFinanceDaysDTO = 7 | 30 | 90;

export type AffiliateFinanceMetricsDTO = {
  orderCount: number;
  salesKopecks: number;
  earnedKopecks: number;
  reversedKopecks: number;
  netKopecks: number;
};

export type AffiliateFinancePeriodDTO = {
  days: AffiliateFinanceDaysDTO;
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

export type AffiliatePartnerAnalyticsParamsDTO = {
  days: AffiliateFinanceDaysDTO;
  codePage: number;
  codePageSize: number;
};

export type AffiliatePartnerAnalyticsDTO = {
  asOf: string;
  period: AffiliateFinancePeriodDTO;
  balance: AffiliateBalanceDTO;
  totals: AffiliateFinanceMetricsDTO;
  daily: Array<AffiliateFinanceMetricsDTO & { date: string }>;
  codes: {
    items: Array<AffiliateFinanceMetricsDTO & { code: string }>;
    total: number;
    page: number;
    pageSize: number;
  };
};

export type AffiliatePartnerLedgerParamsDTO = {
  days: AffiliateFinanceDaysDTO;
  page: number;
  pageSize: number;
};

export type AffiliatePartnerLedgerEntryDTO = {
  id: string;
  code: string;
  kind: "credit" | "reversal";
  amountKopecks: number;
  createdAt: string;
  availableAt: string | null;
  status: "pending" | "available" | "held" | "reversed" | "not_earned";
  holdReason:
    | "order_cancelled"
    | "payment_not_confirmed"
    | "order_not_completed"
    | null;
  isSelfPurchase: boolean;
  partnerPercent: number;
};

export type AffiliatePartnerLedgerDTO = {
  asOf: string;
  period: AffiliateFinancePeriodDTO;
  items: AffiliatePartnerLedgerEntryDTO[];
  total: number;
  page: number;
  pageSize: number;
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
  contract: AffiliateContractDTO & { version: number };
  events: AffiliatePayoutEventDTO[];
};

export type AffiliatePayoutSummaryDTO = {
  asOf: string;
  availableKopecks: number;
  reservedKopecks: number;
  paidKopecks: number;
  debtKopecks: number;
  minimumPayoutKopecks: number;
  canRequest: boolean;
  blockedReason:
    | "partner_inactive"
    | "open_request"
    | "debt"
    | "no_available_balance"
    | "below_minimum"
    | null;
};

export type AffiliatePartnerPayoutsParamsDTO = {
  page: number;
  pageSize: number;
};

export type AffiliatePayoutListDTO = {
  summary: AffiliatePayoutSummaryDTO;
  items: AffiliatePayoutDTO[];
  total: number;
  page: number;
  pageSize: number;
};

export type RecordAffiliatePayoutInputDTO = {
  requestId: string;
  paidAt: string;
  reference: string;
  confirmed: true;
};

export type RejectAffiliatePayoutInputDTO = {
  requestId: string;
  reason: string;
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
