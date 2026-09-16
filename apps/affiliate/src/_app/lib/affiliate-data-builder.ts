import { affiliateCodesQuery } from "@/entities/affiliate-code";
import { affiliatePartnerQuery } from "@/entities/affiliate-partner";
import { requireAffiliateAccess } from "@/features/auth/server";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { makeQueryClient } from "@/shared/lib/query-client";

export async function buildAffiliateData(
  nextPath: "/" | "/codes" | "/cooperation",
  options: { readonly includeCodes?: boolean } = {},
) {
  const { partner, user } = await requireAffiliateAccess(nextPath);
  const queryClient = makeQueryClient();

  queryClient.setQueryData(affiliatePartnerQuery(user.id).queryKey, partner);

  if (options.includeCodes) {
    await queryClient.prefetchQuery(affiliateCodesQuery(user.id));
  }

  return {
    ownerId: user.id,
    state: dehydrateQueryClient(queryClient),
  };
}
