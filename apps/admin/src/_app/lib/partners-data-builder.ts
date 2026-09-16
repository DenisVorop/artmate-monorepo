import { affiliatePartnersQuery } from "@/entities/affiliate-partners";
import { partnerApplicationsQuery } from "@/entities/partner-applications";
import { usersQuery } from "@/entities/users";
import { getQueryClient } from "@/shared/lib/query-client";

export async function buildPartnersData() {
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(
      affiliatePartnersQuery.list({ page: 1, pageSize: 25 }),
    ),
    queryClient.prefetchQuery(affiliatePartnersQuery.selection()),
    queryClient.prefetchQuery(usersQuery.list()),
    queryClient.prefetchQuery(partnerApplicationsQuery.selection()),
  ]);

  return queryClient;
}
