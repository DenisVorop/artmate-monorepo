import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { partnerApplicationsQuery } from "@/entities/partner-applications";
import { PartnerApplicationsPage } from "@/pages/partner-applications";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "Партнёрские заявки - Artmate Admin",
};

const initialListParams = {
  page: 1,
  pageSize: 20,
} as const;

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      routes.login + "?next=" + encodeURIComponent(routes.partnerApplications),
    );
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    partnerApplicationsQuery.list(initialListParams),
  );

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PartnerApplicationsPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
