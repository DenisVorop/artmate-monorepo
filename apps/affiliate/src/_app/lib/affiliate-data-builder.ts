import { affiliatePartnerQuery } from "@/entities/affiliate-partner";
import { requireAffiliateAccess } from "@/features/auth/server";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { makeQueryClient } from "@/shared/lib/query-client";

export async function buildAffiliateData(nextPath: "/" | "/cooperation") {
  const { partner, user } = await requireAffiliateAccess(nextPath);
  const queryClient = makeQueryClient();

  queryClient.setQueryData(affiliatePartnerQuery(user.id).queryKey, partner);

  return {
    ownerId: user.id,
    state: dehydrateQueryClient(queryClient),
  };
}
