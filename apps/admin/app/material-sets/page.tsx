import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { buildMaterialSetsData } from "@/app/lib/material-sets-data-builder";
import { MaterialSetsPage } from "@/pages/material-sets";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Наборы материалов - Artmate Admin",
};

export default async function Page() {
  const session = await getAdminSession();
  if (!session.user)
    redirect(`${routes.login}?next=${encodeURIComponent(routes.materialSets)}`);
  const queryClient = await buildMaterialSetsData();
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <MaterialSetsPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
