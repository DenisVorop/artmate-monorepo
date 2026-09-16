export function getAffiliatePartnerQueryKey(ownerId: string) {
  return ["affiliate-partner", "me", ownerId] as const;
}
