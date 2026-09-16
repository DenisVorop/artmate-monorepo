import { queryOptions } from "@tanstack/react-query";

import { getAffiliatePartner } from "@/shared/actions/affiliate";

import { getAffiliatePartnerQueryKey } from "./query-key";

export function affiliatePartnerQuery(ownerId: string) {
  return queryOptions({
    queryKey: getAffiliatePartnerQueryKey(ownerId),
    queryFn: getAffiliatePartner,
    retry: false,
    retryOnMount: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
