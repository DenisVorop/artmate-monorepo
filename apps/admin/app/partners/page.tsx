import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { buildPartnersData } from "@/app/lib/partners-data-builder";
import { PartnersPage } from "@/pages/partners";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Партнёры - Artmate Admin",
};

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.partners)}`);
  }

  const queryClient = await buildPartnersData();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PartnersPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
