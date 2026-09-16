import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { getAffiliateCodes } from "@/shared/actions/affiliate";

import { affiliateCodeQueryKeys } from "./query-key";

export function affiliateCodesQuery(ownerId: string, page = 1, pageSize = 20) {
  return queryOptions({
    queryKey: affiliateCodeQueryKeys.list(ownerId, page, pageSize),
    queryFn: () => getAffiliateCodes(page, pageSize),
    placeholderData: keepPreviousData,
    retry: false,
    retryOnMount: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
