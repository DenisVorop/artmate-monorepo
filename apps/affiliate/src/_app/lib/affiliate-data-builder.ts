import { affiliateCodesQuery } from "@/entities/affiliate-code";
import {
  affiliateAnalyticsQuery,
  affiliateLedgerQuery,
} from "@/entities/affiliate-finance";
import { affiliatePartnerQuery } from "@/entities/affiliate-partner";
import { affiliatePayoutsQuery } from "@/entities/affiliate-payout";
import { requireAffiliateAccess } from "@/features/auth/server";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { makeQueryClient } from "@/shared/lib/query-client";

export async function buildAffiliateData(
  nextPath: "/" | "/codes" | "/cooperation" | "/payouts",
  options: {
    readonly includeCodes?: boolean;
    readonly includeFinance?: boolean;
    readonly includePayouts?: boolean;
  } = {},
) {
  const { partner, user } = await requireAffiliateAccess(nextPath);
  const queryClient = makeQueryClient();

  queryClient.setQueryData(affiliatePartnerQuery(user.id).queryKey, partner);

  if (options.includeCodes) {
    await queryClient.prefetchQuery(affiliateCodesQuery(user.id));
  }

  if (options.includeFinance) {
    await Promise.all([
      queryClient.prefetchQuery(affiliateAnalyticsQuery(user.id)),
      queryClient.prefetchQuery(affiliateLedgerQuery(user.id)),
    ]);
  }

  if (options.includePayouts) {
    await queryClient.prefetchQuery(affiliatePayoutsQuery(user.id));
  }

  return {
    ownerId: user.id,
    state: dehydrateQueryClient(queryClient),
  };
}
