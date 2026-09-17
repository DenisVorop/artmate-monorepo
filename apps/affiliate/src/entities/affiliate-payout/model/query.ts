import { queryOptions } from "@tanstack/react-query";

import { getAffiliatePayouts } from "@/shared/actions/affiliate";

import { affiliatePayoutQueryKeys } from "./query-key";

export function affiliatePayoutsQuery(
  ownerId: string,
  page = 1,
  pageSize = 10,
) {
  return queryOptions({
    queryKey: affiliatePayoutQueryKeys.list(ownerId, page, pageSize),
    queryFn: () => getAffiliatePayouts(page, pageSize),
    refetchOnWindowFocus: true,
    retry: false,
    retryOnMount: false,
    staleTime: 30_000,
  });
}
