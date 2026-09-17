export const affiliatePayoutQueryKeys = {
  all: (ownerId: string) => ["affiliate-payouts", ownerId] as const,
  list: (ownerId: string, page: number, pageSize: number) =>
    [
      "affiliate-payouts",
      ownerId,
      "list",
      { page, pageSize },
    ] as const,
};
